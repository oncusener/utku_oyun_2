/**
 * Game.tsx — one Skia canvas, one gesture, one thumb.
 *
 * Threading model, because it is the whole design:
 *
 *   The board lives in a *shared value*, not in React state. Every visible
 *   quantity — rotation, drop, burst, collapse, near-miss lean, board contents
 *   — is a shared value read from worklets on the UI thread. React renders this
 *   screen twice per session: once on mount, once when SessionEnd appears.
 *   Nothing re-renders per frame, and nothing re-renders per merge.
 *
 *   That is not just a performance flourish. A collapse changes the board *and*
 *   starts the animation that explains the change; if the board went through a
 *   React commit, the two would land on different frames and pieces would
 *   visibly teleport before sliding. Writing both shared values in one JS tick
 *   makes them arrive in the same UI-thread batch, so the slide is always
 *   honest about where the pieces came from.
 *
 *   Game logic is event-driven, never per-frame, so it stays on the JS thread
 *   where engine.ts can be plain, testable TypeScript. The UI thread only ever
 *   interpolates.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Easing,
  cancelAnimation,
  interpolateColor,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  CODE_EMPTY,
  CODE_PRISM,
  SLOTS,
  applyDrop,
  emptyBoard,
  encodeBoard,
  encodeSlot,
  findNearMiss,
  isBoardFull,
  maskOf,
  nearestSteps,
  offsetFromSteps,
  resolve,
  zeigarnikOffset,
} from './engine';
import type { Board, Piece } from './engine';
import { createBag } from './bag';
import { helpfulness, levelForMerges, settleMs } from './difficulty';
import {
  NEAR_MISS_BRIGHTEN,
  NEAR_MISS_SHIFT_PX,
  TIMING,
  chainFlourish,
  mergeThud,
  playNote,
  stepTick,
} from './feedback';
import { codeColors, geometry, palette } from './theme';
import {
  decideAdMoment,
  noteSessionEnded,
  showInterstitial,
  showRewardedInterstitial,
} from '../ads';
import SessionEnd from '../components/SessionEnd';
import type { SessionStats } from '../components/SessionEnd';

const STEP_RAD = (60 * Math.PI) / 180;
const SLOT_INDICES = [0, 1, 2, 3, 4, 5];

/** Gesture phases, as numbers because worklets read them. */
const PHASE_BUSY = 0;
const PHASE_INPUT = 1;

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

type Geo = {
  cx: number;
  cy: number;
  R: number;
  r: number;
  centerR: number;
  arcR: number;
  nextR: number;
  nextY: number;
};

function layout(width: number, height: number): Geo {
  const cx = width / 2;
  const cy = height * geometry.ringCenterY;
  const R = Math.min(width * geometry.ringFraction, height * 0.21, geometry.ringMax);
  const r = Math.max(
    geometry.pieceMin,
    Math.min(geometry.pieceMax, R * geometry.pieceFraction),
  );
  const centerR = r * 1.02;
  const arcR = centerR + geometry.arcGap;
  const nextR = r * geometry.nextFraction;
  return {
    cx,
    cy,
    R,
    r,
    centerR,
    arcR,
    nextR,
    nextY: cy + arcR + geometry.nextGap + nextR,
  };
}

/* ------------------------------------------------------------------ *
 * Shared values
 * ------------------------------------------------------------------ */

type Rings = {
  /** Unwrapped rotation in 60deg steps, so the 5 -> 0 seam never spins backwards. */
  steps: SharedValue<number>;
  /** The detent the ring is snapping toward; this is what a drop reads. */
  target: SharedValue<number>;
  dragStart: SharedValue<number>;
  phase: SharedValue<number>;

  board: SharedValue<number[]>;
  /** Per-slot counter-clockwise travel, in steps, for the collapse slide. */
  travel: SharedValue<number[]>;
  collapse: SharedValue<number>;
  /** Slot where a prism just condensed, so it can grow in rather than blink on. */
  residue: SharedValue<number>;

  clearMask: SharedValue<number>;
  burst: SharedValue<number>;

  settle: SharedValue<number>;
  active: SharedValue<number>;
  next: SharedValue<number>;
  drop: SharedValue<number>;
  activeAlpha: SharedValue<number>;

  nmA: SharedValue<number>;
  nmB: SharedValue<number>;
  nmProgress: SharedValue<number>;

  play: SharedValue<number>;
};

function useRings(): Rings {
  const steps = useSharedValue(0);
  const target = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const phase = useSharedValue(PHASE_BUSY);
  const board = useSharedValue<number[]>(encodeBoard(emptyBoard()));
  const travel = useSharedValue<number[]>([0, 0, 0, 0, 0, 0]);
  const collapse = useSharedValue(0);
  const residue = useSharedValue(-1);
  const clearMask = useSharedValue(0);
  const burst = useSharedValue(0);
  const settle = useSharedValue(0);
  const active = useSharedValue(CODE_EMPTY);
  const next = useSharedValue(CODE_EMPTY);
  const drop = useSharedValue(0);
  const activeAlpha = useSharedValue(0);
  const nmA = useSharedValue(-1);
  const nmB = useSharedValue(-1);
  const nmProgress = useSharedValue(0);
  const play = useSharedValue(1);

  return useMemo(
    () => ({
      steps,
      target,
      dragStart,
      phase,
      board,
      travel,
      collapse,
      residue,
      clearMask,
      burst,
      settle,
      active,
      next,
      drop,
      activeAlpha,
      nmA,
      nmB,
      nmProgress,
      play,
    }),
    // Shared values are stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

/* ------------------------------------------------------------------ *
 * Controller
 * ------------------------------------------------------------------ */

type Session = {
  board: Board;
  bag: ReturnType<typeof createBag>;
  active: Piece | null;
  next: Piece | null;
  score: number;
  merges: number;
  bestChain: number;
  /** Bumped to abandon any in-flight sequence. Nothing here needs unwinding. */
  run: number;
};

function useController(sv: Rings, onEnd: (stats: SessionStats) => void) {
  const ref = useRef<Session>({
    board: emptyBoard(),
    bag: createBag(),
    active: null,
    next: null,
    score: 0,
    merges: 0,
    bestChain: 0,
    run: 0,
  });

  return useMemo(() => {
    const s = ref.current;
    const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
    const alive = (token: number) => s.run === token;
    const pushBoard = () => {
      sv.board.value = encodeBoard(s.board);
    };

    const spawn = () => {
      const ctx = () => ({
        board: s.board,
        helpfulness: helpfulness(levelForMerges(s.merges)),
      });
      s.active = s.next ?? s.bag.draw(ctx());
      // Drawn a turn early, so it reads the board as it is now rather than as
      // it will be — the preview is a hint, not an oracle.
      s.next = s.bag.draw(ctx());
      sv.active.value = encodeSlot(s.active);
      sv.next.value = encodeSlot(s.next);
      sv.drop.value = 0;
      sv.activeAlpha.value = 1;
      sv.settle.value = 1;
      sv.phase.value = PHASE_INPUT;

      // The settle arc *is* the timer. Running it as a UI-thread animation
      // means the countdown cannot be starved by JS work, and its completion
      // callback is the only place the timer touches game logic.
      sv.settle.value = withTiming(
        0,
        { duration: settleMs(levelForMerges(s.merges)), easing: Easing.linear },
        (finished) => {
          'worklet';
          if (!finished) return;
          if (sv.phase.value !== PHASE_INPUT) return;
          sv.phase.value = PHASE_BUSY;
          // Read the detent here, on the UI thread that owns it, and pass it
          // across. The JS-side copy of a UI-written shared value can lag.
          runOnJS(commitDrop)(sv.target.value);
        },
      );
    };

    const nearMiss = async (token: number) => {
      const nm = findNearMiss(s.board);
      if (!nm) return;

      await sleep(TIMING.NEAR_MISS_DELAY_MS);
      if (!alive(token)) return;

      sv.nmA.value = nm.a;
      sv.nmB.value = nm.b;
      sv.nmProgress.value = withTiming(1, {
        duration: TIMING.NEAR_MISS_RISE_MS,
        easing: Easing.out(Easing.quad),
      });
      await sleep(TIMING.NEAR_MISS_RISE_MS);
      if (!alive(token)) return;

      sv.nmProgress.value = withTiming(0, {
        duration: TIMING.NEAR_MISS_FALL_MS,
        easing: Easing.in(Easing.quad),
      });
      await sleep(TIMING.NEAR_MISS_FALL_MS);
      if (!alive(token)) return;

      sv.nmA.value = -1;
      sv.nmB.value = -1;
    };

    const settleBoard = async (token: number, steps: number) => {
      await sleep(TIMING.POST_DROP_MS);
      if (!alive(token)) return;

      const res = resolve(s.board);

      for (let i = 0; i < res.steps.length; i++) {
        const step = res.steps[i];

        sv.clearMask.value = maskOf(step.indices);
        sv.burst.value = 0;
        sv.burst.value = withTiming(1, {
          duration: TIMING.BURST_MS,
          easing: Easing.out(Easing.cubic),
        });
        mergeThud();
        playNote(i);
        await sleep(TIMING.BURST_MS);
        if (!alive(token)) return;

        // One tick, one UI-thread batch: the collapsed board, the per-slot
        // travel it implies, and the progress value that animates it.
        s.board = step.boardAfter;
        pushBoard();
        sv.travel.value = step.travel;
        sv.residue.value = step.residue;
        sv.clearMask.value = 0;
        sv.burst.value = 0;
        sv.collapse.value = 1;
        sv.collapse.value = withTiming(0, {
          duration: TIMING.COLLAPSE_MS,
          easing: Easing.out(Easing.cubic),
        });

        if (i < res.steps.length - 1) {
          await sleep(TIMING.CHAIN_GAP_MS);
          if (!alive(token)) return;
        }
      }

      if (res.chain >= 2) chainFlourish();

      if (res.chain > 0) {
        // Let the last slide finish before another piece arrives.
        await sleep(TIMING.COLLAPSE_MS);
        if (!alive(token)) return;
      }

      s.score += res.scoreGained;
      s.merges += res.chain;
      s.bestChain = Math.max(s.bestChain, res.chain);

      // Nowhere left to put anything: every rotation is a losing drop, so end
      // here rather than handing the player a piece and a countdown they cannot
      // use. Checked before the near-miss lean — a full board gets the game-over
      // framing instead, which is the same gesture done better.
      if (isBoardFull(s.board)) {
        void endSession(offsetFromSteps(steps), steps, false);
        return;
      }

      if (res.chain === 0) {
        await nearMiss(token);
        if (!alive(token)) return;
      }

      spawn();
    };

    /**
     * `bumped` distinguishes the two ways a session ends: a piece rejected by
     * an occupied slot has something to animate, a board that simply filled up
     * does not — its last piece already landed.
     */
    const endSession = async (offset: number, steps: number, bumped: boolean) => {
      s.run += 1;
      const token = s.run;
      sv.phase.value = PHASE_BUSY;
      cancelAnimation(sv.settle);
      sv.settle.value = 0;

      if (bumped) {
        // The piece bumps the occupied slot and sinks back. It never lands.
        sv.drop.value = withSequence(
          withTiming(0.26, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 150, easing: Easing.inOut(Easing.quad) }),
        );
        sv.activeAlpha.value = withTiming(0.3, { duration: 240 });
      }

      // Turn the dial — never the pieces — so the board's most complete run
      // finishes under the anchor. See zeigarnikOffset for why rotation is the
      // only lever available here.
      const framed = nearestSteps(steps, zeigarnikOffset(s.board, offset));
      sv.target.value = framed;
      sv.steps.value = withTiming(framed, {
        duration: TIMING.GAME_OVER_TURN_MS,
        easing: Easing.out(Easing.cubic),
      });

      await sleep(TIMING.GAME_OVER_HOLD_MS);
      if (!alive(token)) return;

      sv.play.value = withTiming(0, {
        duration: TIMING.CROSS_FADE_MS,
        easing: Easing.inOut(Easing.quad),
      });
      onEnd({
        score: s.score,
        level: levelForMerges(s.merges),
        merges: s.merges,
        bestChain: s.bestChain,
      });
    };

    /** `steps` is the committed detent, read on the UI thread by the caller. */
    const commitDrop = (steps: number) => {
      const token = s.run;
      cancelAnimation(sv.settle);
      sv.settle.value = 0;
      sv.phase.value = PHASE_BUSY;

      const piece = s.active;
      if (!piece) return;

      const offset = offsetFromSteps(steps);
      const landed = applyDrop(s.board, offset, piece);
      if (!landed.ok) {
        void endSession(offset, steps, true);
        return;
      }

      sv.drop.value = withTiming(1, {
        duration: TIMING.DROP_MS,
        easing: Easing.in(Easing.quad),
      });

      setTimeout(() => {
        if (!alive(token)) return;
        // The flying piece is exactly on top of the anchor slot right now, so
        // handing it to the ring and hiding it in the same tick is invisible.
        s.board = landed.board;
        pushBoard();
        sv.activeAlpha.value = 0;
        s.active = null;
        void settleBoard(token, steps);
      }, TIMING.DROP_MS);
    };

    /**
     * Put a fresh, empty ring on screen.
     *
     * `keepScore` is the whole difference between a new game and a rewarded
     * continue: the board is wiped either way, but a continue keeps everything
     * the player already earned. The bag is reset in both cases so a continue
     * starts from the same generous opening weights rather than from whatever
     * drought killed the previous board.
     */
    const beginRound = (keepScore: boolean) => {
      s.run += 1;
      s.board = emptyBoard();
      s.bag.reset();
      s.active = null;
      s.next = null;
      if (!keepScore) {
        s.score = 0;
        s.merges = 0;
        s.bestChain = 0;
      }

      pushBoard();
      sv.travel.value = [0, 0, 0, 0, 0, 0];
      sv.collapse.value = 0;
      sv.residue.value = -1;
      sv.clearMask.value = 0;
      sv.burst.value = 0;
      sv.nmA.value = -1;
      sv.nmB.value = -1;
      sv.nmProgress.value = 0;
      sv.steps.value = 0;
      sv.target.value = 0;
      sv.dragStart.value = 0;
      sv.drop.value = 0;
      sv.play.value = 1;

      spawn();
    };

    const restart = () => beginRound(false);
    const revive = () => beginRound(true);

    const abandon = () => {
      s.run += 1;
      sv.phase.value = PHASE_BUSY;
      cancelAnimation(sv.settle);
    };

    return { restart, revive, commitDrop, abandon };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ------------------------------------------------------------------ *
 * Skia nodes
 * ------------------------------------------------------------------ */

function SlotNode({ index, geo, sv }: { index: number; geo: Geo; sv: Rings }) {
  const theta0 = ((-90 + index * 60) * Math.PI) / 180;
  const bit = 1 << index;
  const dotR = geo.r * 0.3;

  const transform = useDerivedValue(() => {
    // Start at the angle this piece slid from and ease home. Travel is always
    // counter-clockwise, so adding it puts the piece clockwise of its
    // destination and the decay walks it back the way it fell.
    const a = theta0 + sv.travel.value[index] * sv.collapse.value * STEP_RAD;

    let lean = 0;
    if (sv.nmA.value === index) lean = NEAR_MISS_SHIFT_PX;
    else if (sv.nmB.value === index) lean = -NEAR_MISS_SHIFT_PX;
    lean *= sv.nmProgress.value;

    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // (-sin, cos) is the clockwise tangent, so the pair leans along the ring.
    return [
      { translateX: geo.cx + geo.R * ca - sa * lean },
      { translateY: geo.cy + geo.R * sa + ca * lean },
    ];
    // `geo` is a plain value captured in the worklet closure, not a shared
    // value, so it has to be declared: without it the ring keeps drawing
    // itself at whatever size the screen was when this node first mounted.
  }, [geo, theta0]);

  const emptyAlpha = useDerivedValue(() => (sv.board.value[index] > CODE_EMPTY ? 0 : 1));

  const pieceAlpha = useDerivedValue(() => {
    if (sv.board.value[index] <= CODE_EMPTY) return 0;
    return (sv.clearMask.value & bit) !== 0 ? 1 - sv.burst.value : 1;
  });

  const pieceR = useDerivedValue(() => {
    const base =
      (sv.clearMask.value & bit) !== 0 ? geo.r * (1 + 0.4 * sv.burst.value) : geo.r;
    // A condensed prism grows out of the hole on the same curve the survivors
    // slide in on, so the reward reads as part of the collapse.
    return sv.residue.value === index ? base * (1 - sv.collapse.value) : base;
  }, [geo, bit, index]);

  const fill = useDerivedValue(() => {
    const code = sv.board.value[index];
    return code > CODE_EMPTY ? codeColors[code] : codeColors[0];
  });

  // A prism is a colourless ring: same silhouette, hollow centre.
  const prismR = useDerivedValue(
    () => (sv.board.value[index] === CODE_PRISM ? pieceR.value * 0.45 : 0),
    [index, pieceR],
  );
  const prismAlpha = useDerivedValue(
    () => (sv.board.value[index] === CODE_PRISM ? pieceAlpha.value : 0),
    [index, pieceAlpha],
  );

  const burstR = useDerivedValue(() => geo.r * (1 + 0.95 * sv.burst.value), [geo]);
  const burstAlpha = useDerivedValue(() =>
    (sv.clearMask.value & bit) !== 0 ? 0.5 * (1 - sv.burst.value) : 0,
  );

  const leanGlow = useDerivedValue(() =>
    sv.nmA.value === index || sv.nmB.value === index
      ? NEAR_MISS_BRIGHTEN * sv.nmProgress.value
      : 0,
  );

  return (
    <Group transform={transform}>
      <Circle r={dotR} color={palette.slotEmpty} opacity={emptyAlpha} />
      <Circle
        r={dotR}
        color={palette.slotEmptyRim}
        opacity={emptyAlpha}
        style="stroke"
        strokeWidth={1}
      />
      <Circle r={pieceR} color={fill} opacity={pieceAlpha} />
      <Circle r={prismR} color={palette.bg} opacity={prismAlpha} />
      <Circle r={pieceR} color="#FFFFFF" opacity={leanGlow} />
      <Circle r={burstR} color={fill} opacity={burstAlpha} style="stroke" strokeWidth={2} />
    </Group>
  );
}

function ActivePiece({ geo, sv }: { geo: Geo; sv: Rings }) {
  const cy = useDerivedValue(() => geo.cy - geo.R * sv.drop.value, [geo]);
  const r = useDerivedValue(
    () => geo.centerR + (geo.r - geo.centerR) * sv.drop.value,
    [geo],
  );
  const fill = useDerivedValue(() => {
    const code = sv.active.value;
    return code > CODE_EMPTY ? codeColors[code] : codeColors[0];
  });
  const prismR = useDerivedValue(
    () => (sv.active.value === CODE_PRISM ? r.value * 0.45 : 0),
    [r],
  );
  const prismAlpha = useDerivedValue(() =>
    sv.active.value === CODE_PRISM ? sv.activeAlpha.value : 0,
  );

  return (
    <Group>
      <Circle cx={geo.cx} cy={cy} r={r} color={fill} opacity={sv.activeAlpha} />
      <Circle cx={geo.cx} cy={cy} r={prismR} color={palette.bg} opacity={prismAlpha} />
    </Group>
  );
}

function NextPiece({ geo, sv }: { geo: Geo; sv: Rings }) {
  const fill = useDerivedValue(() => {
    const code = sv.next.value;
    return code > CODE_EMPTY ? codeColors[code] : codeColors[0];
  });
  const alpha = useDerivedValue(() => (sv.next.value > CODE_EMPTY ? 1 : 0));
  const prismR = useDerivedValue(
    () => (sv.next.value === CODE_PRISM ? geo.nextR * 0.45 : 0),
    [geo],
  );

  return (
    <Group opacity={geometry.nextOpacity}>
      <Circle cx={geo.cx} cy={geo.nextY} r={geo.nextR} color={fill} opacity={alpha} />
      <Circle cx={geo.cx} cy={geo.nextY} r={prismR} color={palette.bg} opacity={alpha} />
    </Group>
  );
}

function SettleArc({ geo, sv }: { geo: Geo; sv: Rings }) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    // Start the sweep at 12 o'clock so the arc drains away from the anchor.
    p.addArc(
      {
        x: geo.cx - geo.arcR,
        y: geo.cy - geo.arcR,
        width: geo.arcR * 2,
        height: geo.arcR * 2,
      },
      -90,
      360,
    );
    return p;
  }, [geo]);

  const color = useDerivedValue(() =>
    interpolateColor(
      sv.settle.value,
      [0, 0.28, 1],
      [palette.settleUrgent, palette.settleUrgent, palette.settleCalm],
    ),
  );

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={geometry.arcWidth}
      strokeCap="round"
      start={0}
      end={sv.settle}
      color={color}
    />
  );
}

function Anchor({ geo }: { geo: Geo }) {
  const notch = useMemo(() => {
    const p = Skia.Path.Make();
    const y = geo.cy - geo.R - geo.r - 12;
    p.moveTo(geo.cx - 6, y - 5);
    p.lineTo(geo.cx, y + 2);
    p.lineTo(geo.cx + 6, y - 5);
    return p;
  }, [geo]);

  return (
    <Group>
      <Circle
        cx={geo.cx}
        cy={geo.cy - geo.R}
        r={geo.r + 5}
        color={palette.anchorTarget}
        style="stroke"
        strokeWidth={1.5}
      />
      <Path
        path={notch}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
        strokeJoin="round"
        color={palette.anchor}
      />
    </Group>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export default function Game() {
  const { width, height } = useWindowDimensions();
  const geo = useMemo(() => layout(width, height), [width, height]);

  const [ended, setEnded] = useState<SessionStats | null>(null);
  const [canRevive, setCanRevive] = useState(false);
  /** One continue per run, so a good run ends on its own terms eventually. */
  const revived = useRef(false);
  const sv = useRings();

  const handleEnded = useCallback((stats: SessionStats) => {
    setEnded(stats);
    noteSessionEnded();

    // One ad at most, and which one is the ad module's call — see chooseAdMoment
    // for why the interstitial has to get first refusal rather than last.
    const moment = decideAdMoment(revived.current);
    setCanRevive(moment === 'revive');
    if (moment === 'interstitial') void showInterstitial();
  }, []);

  const ctrl = useController(sv, handleEnded);

  useEffect(() => {
    ctrl.restart();
    return ctrl.abandon;
  }, [ctrl]);

  const restart = useCallback(() => {
    revived.current = false;
    setCanRevive(false);
    setEnded(null);
    ctrl.restart();
  }, [ctrl]);

  const revive = useCallback(async () => {
    // Only a confirmed reward continues the run; closing the ad early does not.
    const earned = await showRewardedInterstitial();
    if (!earned) return;
    revived.current = true;
    setCanRevive(false);
    setEnded(null);
    ctrl.revive();
  }, [ctrl]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Activate on touch: a tap with no travel is a legitimate "drop it here".
        .minDistance(0)
        .onBegin(() => {
          'worklet';
          if (sv.phase.value !== PHASE_INPUT) return;
          sv.dragStart.value = sv.target.value;
        })
        .onUpdate((e) => {
          'worklet';
          if (sv.phase.value !== PHASE_INPUT) return;
          const wanted =
            sv.dragStart.value + Math.round(e.translationX / geometry.pxPerStep);
          if (wanted === sv.target.value) return;
          sv.target.value = wanted;
          sv.steps.value = withTiming(wanted, {
            duration: TIMING.SNAP_MS,
            easing: Easing.out(Easing.cubic),
          });
          runOnJS(stepTick)();
        })
        // onFinalize, not onEnd: a cancelled gesture still means the thumb left
        // the glass, and releasing is how you commit.
        .onFinalize(() => {
          'worklet';
          if (sv.phase.value !== PHASE_INPUT) return;
          sv.phase.value = PHASE_BUSY;
          runOnJS(ctrl.commitDrop)(sv.target.value);
        }),
    [sv, ctrl],
  );

  const ringTransform = useDerivedValue(() => [{ rotate: sv.steps.value * STEP_RAD }]);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill} collapsable={false}>
          <Canvas style={styles.fill}>
            <Group opacity={sv.play}>
              <Circle cx={geo.cx} cy={geo.cy} r={geo.R * 1.7}>
                <RadialGradient
                  c={vec(geo.cx, geo.cy)}
                  r={geo.R * 1.7}
                  colors={[palette.glow, palette.bg]}
                />
              </Circle>

              <Circle
                cx={geo.cx}
                cy={geo.cy}
                r={geo.R}
                color={palette.ringTrack}
                style="stroke"
                strokeWidth={1}
              />

              <Anchor geo={geo} />

              <Group transform={ringTransform} origin={vec(geo.cx, geo.cy)}>
                {SLOT_INDICES.map((i) => (
                  <SlotNode key={i} index={i} geo={geo} sv={sv} />
                ))}
              </Group>

              <SettleArc geo={geo} sv={sv} />
              <ActivePiece geo={geo} sv={sv} />
              <NextPiece geo={geo} sv={sv} />
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {ended ? (
        <SessionEnd
          stats={ended}
          onRestart={restart}
          onRevive={canRevive ? revive : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  fill: { flex: 1 },
});

export { layout, SLOTS };
