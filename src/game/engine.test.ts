/**
 * engine.test.ts — run with `npm test` (node --test, no bundler, no jest).
 *
 * The hand-written cases pin down the rules a designer would argue about. The
 * exhaustive sweep at the bottom walks all 15,625 reachable boards and asserts
 * the invariants that keep the game from wedging: resolve always terminates,
 * pieces are conserved, and nothing ever slides clockwise.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CODE_EMPTY,
  CODE_PRISM,
  SLOTS,
  anchorIndex,
  applyDrop,
  canDrop,
  chainScore,
  collapse,
  compatible,
  decodeSlot,
  emptyBoard,
  encodeBoard,
  encodeSlot,
  findAdjacentPair,
  findClosestPair,
  findMatch,
  PRISM_RUN_LENGTH,
  completesRun,
  findNearMiss,
  hasColor,
  hasLivePair,
  isBoardFull,
  maskOf,
  mod,
  nearestSteps,
  offsetFromSteps,
  resolve,
  zeigarnikOffset,
} from './engine.ts';
import type { Board, Color, Piece } from './engine.ts';

import { createBag, seededRng, PRISM_WEIGHT } from './bag.ts';
import { CHAIN_SCALE, noteForChain } from './scale.ts';
import {
  FLOOR_SETTLE_MS,
  HELP_FLOOR,
  MERGES_PER_LEVEL,
  START_SETTLE_MS,
  helpfulness,
  levelForMerges,
  settleMs,
} from './difficulty.ts';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const c = (n: Color): Piece => ({ color: n });
const P: Piece = { prism: true };
const _ = null;

/** Build a six-slot board positionally, so tests read like the ring looks. */
function b(...slots: Board): Board {
  assert.equal(slots.length, SLOTS, 'test fixture must have 6 slots');
  return slots;
}

const occupied = (board: Board) => board.filter((s) => s !== null).length;
const codes = (board: Board) => encodeBoard(board).join(',');

/* ------------------------------------------------------------------ *
 * Rotation
 * ------------------------------------------------------------------ */

test("anchorIndex maps ring offset to the slot under 12 o'clock", () => {
  assert.equal(anchorIndex(0), 0);
  assert.equal(anchorIndex(1), 5);
  assert.equal(anchorIndex(2), 4);
  assert.equal(anchorIndex(5), 1);
  // Unwrapped drag positions are welcome.
  assert.equal(anchorIndex(6), 0);
  assert.equal(anchorIndex(-1), 1);
});

test('offsetFromSteps wraps the unwrapped drag counter', () => {
  assert.equal(offsetFromSteps(0), 0);
  assert.equal(offsetFromSteps(6), 0);
  assert.equal(offsetFromSteps(-1), 5);
  assert.equal(offsetFromSteps(7.4), 1);
  assert.equal(offsetFromSteps(-2.6), 3);
});

test('nearestSteps never spins the long way round', () => {
  assert.equal(nearestSteps(0, 1), 1);
  assert.equal(nearestSteps(0, 5), -1);
  assert.equal(nearestSteps(5, 0), 6);
  assert.equal(nearestSteps(-3, 2), -4);

  for (let cur = -14; cur <= 14; cur++) {
    for (let target = 0; target < SLOTS; target++) {
      const got = nearestSteps(cur, target);
      assert.equal(offsetFromSteps(got), target, `${cur} -> ${target}`);
      assert.ok(Math.abs(got - cur) <= SLOTS / 2, `${cur} -> ${target} took the long way`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

test('findMatch finds a plain run of three', () => {
  assert.deepEqual(findMatch(b(c(0), c(0), c(0), _, _, _)), { start: 0, len: 3, color: 0 });
  assert.deepEqual(findMatch(b(_, c(1), c(1), c(1), _, _)), { start: 1, len: 3, color: 1 });
});

test('findMatch wraps around the seam', () => {
  // Slots 5, 0, 1 — a run that only exists because the ring is circular.
  assert.deepEqual(findMatch(b(c(2), c(2), _, _, _, c(2))), { start: 5, len: 3, color: 2 });
});

test('findMatch prefers the longest run', () => {
  assert.deepEqual(findMatch(b(c(0), c(0), c(0), c(0), _, _)), {
    start: 0,
    len: 4,
    color: 0,
  });
  assert.deepEqual(findMatch(b(c(0), c(0), c(0), c(0), c(0), _)), {
    start: 0,
    len: 5,
    color: 0,
  });
  assert.deepEqual(findMatch(b(c(1), c(1), c(1), c(1), c(1), c(1))), {
    start: 0,
    len: 6,
    color: 1,
  });
});

test('findMatch treats a prism as any colour', () => {
  assert.deepEqual(findMatch(b(c(0), P, c(0), _, _, _)), { start: 0, len: 3, color: 0 });
  assert.deepEqual(findMatch(b(P, c(2), c(2), _, _, _)), { start: 0, len: 3, color: 2 });
  // A prism cannot bridge two different colours.
  assert.equal(findMatch(b(c(0), P, c(1), _, _, _)), null);
  // Three prisms agree vacuously: no colour, still a merge.
  assert.deepEqual(findMatch(b(P, P, P, _, _, _)), { start: 0, len: 3, color: null });
});

test('findMatch requires three adjacent, occupied slots', () => {
  assert.equal(findMatch(emptyBoard()), null);
  assert.equal(findMatch(b(c(0), c(0), _, c(0), _, _)), null, 'a gap breaks the run');
  assert.equal(findMatch(b(c(0), c(1), c(0), c(1), c(0), c(1))), null);
  assert.equal(findMatch(b(c(0), c(0), _, _, _, _)), null, 'two is not enough');
});

test('findMatch breaks ties toward the lowest start index', () => {
  assert.deepEqual(findMatch(b(c(1), c(1), c(1), c(0), c(0), c(0))), {
    start: 0,
    len: 3,
    color: 1,
  });
});

/* ------------------------------------------------------------------ *
 * Collapse
 * ------------------------------------------------------------------ */

test('collapse slides survivors counter-clockwise into the hole', () => {
  const board = b(c(1), c(1), c(1), c(0), c(2), c(0));
  const out = collapse(board, { start: 0, len: 3, color: 1 });
  assert.equal(codes(out.board), '0,2,0,-1,-1,-1');
  assert.deepEqual(out.travel, [3, 3, 3, 0, 0, 0]);
});

test('collapse swallows a pre-existing gap on the way down', () => {
  // Empty slot at 1; both survivors slide three steps and end up touching.
  const board = b(c(0), _, c(1), c(1), c(1), c(0));
  const out = collapse(board, { start: 2, len: 3, color: 1 });
  assert.equal(codes(out.board), '-1,-1,0,0,-1,-1');
  assert.deepEqual(out.travel, [0, 0, 3, 3, 0, 0]);
});

test('collapse lets a lone survivor fall the whole way', () => {
  const board = b(c(0), c(0), c(0), _, c(1), _);
  const out = collapse(board, { start: 0, len: 3, color: 0 });
  assert.equal(codes(out.board), '1,-1,-1,-1,-1,-1');
  assert.equal(out.travel[0], 4, 'slot 4 -> slot 0 is four steps counter-clockwise');
});

test('collapse of a full-ring run leaves only its prism', () => {
  const board = b(c(2), c(2), c(2), c(2), c(2), c(2));
  const out = collapse(board, { start: 0, len: 6, color: 2 });
  assert.equal(codes(out.board), `${CODE_PRISM},-1,-1,-1,-1,-1`);
  assert.equal(out.residue, 0);
  assert.deepEqual(out.travel, [0, 0, 0, 0, 0, 0]);
});

test('a run of three vanishes, a run of four condenses into a prism', () => {
  const three = collapse(b(c(0), c(0), c(0), c(1), _, _), { start: 0, len: 3, color: 0 });
  assert.equal(three.residue, -1, 'three is the honest minimum, and pays nothing extra');
  assert.equal(codes(three.board), '1,-1,-1,-1,-1,-1');

  const four = collapse(b(c(0), c(0), c(0), c(0), c(1), _), { start: 0, len: 4, color: 0 });
  assert.equal(four.residue, 0, "the prism takes the hole's counter-clockwise end");
  assert.equal(codes(four.board), `${CODE_PRISM},1,-1,-1,-1,-1`);
});

test('a four-run is the only cascade the ring can actually reach', () => {
  // Reachable in play: [X,X,_,X,Y,Y] has no run, and dropping X into the gap
  // makes four. The prism it leaves is wild, so it completes the surviving pair.
  const res = resolve(b(c(0), c(0), c(0), c(0), c(1), c(1)));
  assert.equal(res.chain, 2);
  assert.equal(res.scoreGained, 3);
  assert.equal(codes(res.steps[0].boardAfter), `${CODE_PRISM},1,1,-1,-1,-1`);
  assert.equal(res.steps[0].residue, 0);
  assert.equal(occupied(res.board), 0);
});

test('collapse preserves clockwise order of survivors', () => {
  const board = b(c(0), c(0), c(0), c(1), c(2), P);
  const out = collapse(board, { start: 0, len: 3, color: 0 });
  assert.equal(codes(out.board), `1,2,${CODE_PRISM},-1,-1,-1`);
});

/* ------------------------------------------------------------------ *
 * Resolution and cascades
 * ------------------------------------------------------------------ */

test('chainScore is triangular', () => {
  assert.equal(chainScore(0), 0);
  assert.equal(chainScore(1), 1);
  assert.equal(chainScore(2), 3);
  assert.equal(chainScore(3), 6);
});

test('resolve clears a single run and scores one', () => {
  const res = resolve(b(c(0), c(0), c(0), _, _, _));
  assert.equal(res.chain, 1);
  assert.equal(res.scoreGained, 1);
  assert.equal(codes(res.board), '-1,-1,-1,-1,-1,-1');
  assert.deepEqual(res.steps[0].indices, [0, 1, 2]);
});

test('resolve cascades when the collapse reveals a second run', () => {
  // BBB clears, the three A's slide together, and the ring merges again.
  const res = resolve(b(c(1), c(1), c(1), c(0), c(0), c(0)));
  assert.equal(res.chain, 2, 'clearing one run at a time is what makes this chain');
  assert.equal(res.scoreGained, 3);
  assert.equal(codes(res.steps[0].boardAfter), '0,0,0,-1,-1,-1');
  assert.equal(codes(res.board), '-1,-1,-1,-1,-1,-1');
  assert.deepEqual(res.steps[1].indices, [0, 1, 2]);
});

test('resolve cascades across the seam and through a gap', () => {
  // Run at 5,0,1 clears; the remaining colour-2 pieces pack together and go.
  const res = resolve(b(c(1), c(1), _, c(2), c(2), c(1)));
  assert.equal(res.chain, 1, 'only two 2s survive — nothing more to merge');
  assert.equal(occupied(res.board), 2);
});

test('resolve is a no-op when nothing matches', () => {
  const board = b(c(0), c(1), c(0), c(1), _, _);
  const res = resolve(board);
  assert.equal(res.chain, 0);
  assert.equal(res.scoreGained, 0);
  assert.equal(codes(res.board), codes(board));
  assert.equal(res.steps.length, 0);
});

test('resolve does not mutate the board it is handed', () => {
  const board = b(c(0), c(0), c(0), c(1), _, _);
  const before = codes(board);
  resolve(board);
  assert.equal(codes(board), before);
});

/* ------------------------------------------------------------------ *
 * Dropping and the end of the session
 * ------------------------------------------------------------------ */

test('a drop lands in the slot under the anchor', () => {
  const first = applyDrop(emptyBoard(), 0, c(0));
  assert.ok(first.ok);
  assert.equal(first.index, 0);
  assert.equal(codes(first.board), '0,-1,-1,-1,-1,-1');

  const rotated = applyDrop(emptyBoard(), 1, c(2));
  assert.ok(rotated.ok);
  assert.equal(rotated.index, 5);
  assert.equal(codes(rotated.board), '-1,-1,-1,-1,-1,2');
});

test('dropping onto an occupied slot ends the session', () => {
  const board = b(c(0), _, _, _, _, _);
  assert.equal(canDrop(board, 0), false);
  const res = applyDrop(board, 0, c(1));
  assert.equal(res.ok, false);
  assert.equal(res.index, 0);
  // Rotating one step finds room again.
  assert.equal(canDrop(board, 1), true);
});

test('a full ring has nowhere left to drop', () => {
  const full = b(c(0), c(1), c(0), c(1), c(0), c(1));
  assert.equal(findMatch(full), null, 'full but stable — the genuine dead end');
  assert.equal(isBoardFull(full), true);
  for (let offset = 0; offset < SLOTS; offset++) {
    assert.equal(canDrop(full, offset), false);
  }
});

test('isBoardFull agrees with there being no legal drop', () => {
  assert.equal(isBoardFull(emptyBoard()), false);
  assert.equal(isBoardFull(b(c(0), c(0), c(0), c(0), c(0), _)), false);
  assert.equal(isBoardFull(b(c(0), c(1), c(2), P, c(1), c(2))), true);

  // The two notions must never disagree, or the session ends at the wrong moment.
  for (const board of allBoards()) {
    const anyDrop = [0, 1, 2, 3, 4, 5].some((offset) => canDrop(board, offset));
    assert.equal(isBoardFull(board), !anyDrop, `disagreement on ${codes(board)}`);
  }
});

/* ------------------------------------------------------------------ *
 * Near miss
 * ------------------------------------------------------------------ */

test('findNearMiss spots two together with a third one slot out', () => {
  // Pair at 0,1; third at 3 — one slot past the clockwise end.
  assert.deepEqual(findNearMiss(b(c(0), c(0), _, c(0), _, _)), {
    a: 0,
    b: 1,
    third: 3,
    color: 0,
  });
  // Third at 4 — one slot past the counter-clockwise end.
  assert.deepEqual(findNearMiss(b(c(0), c(0), _, _, c(0), _)), {
    a: 0,
    b: 1,
    third: 4,
    color: 0,
  });
});

test('findNearMiss accepts a prism as the pair or the third piece', () => {
  assert.deepEqual(findNearMiss(b(c(0), P, _, c(0), _, _)), {
    a: 0,
    b: 1,
    third: 3,
    color: 0,
  });
  assert.deepEqual(findNearMiss(b(c(0), c(0), _, P, _, _)), {
    a: 0,
    b: 1,
    third: 3,
    color: 0,
  });
  assert.equal(findNearMiss(b(P, P, _, c(0), _, _)), null, 'two prisms chase no colour');
});

test('findNearMiss stays quiet when there is nothing to ache about', () => {
  assert.equal(findNearMiss(emptyBoard()), null);
  assert.equal(findNearMiss(b(c(0), c(0), _, _, _, _)), null, 'no third piece');
  assert.equal(
    findNearMiss(b(c(0), c(0), _, c(1), _, _)),
    null,
    'third is the wrong colour',
  );
  assert.equal(
    findNearMiss(b(c(0), c(0), c(0), _, _, _)),
    null,
    'that is a merge, not a near miss',
  );
  assert.equal(findNearMiss(b(c(0), c(0), c(0), c(0), _, _)), null);
});

test('findNearMiss ignores a third piece that is merely adjacent', () => {
  // Slot 2 touches the pair, so this is a run, not a near miss.
  assert.equal(findNearMiss(b(_, c(0), c(0), c(0), _, _)), null);
});

/* ------------------------------------------------------------------ *
 * Zeigarnik framing
 * ------------------------------------------------------------------ */

test('zeigarnikOffset parks a near-miss pair under the anchor', () => {
  const board = b(_, _, c(0), c(0), _, c(0));
  const nm = findNearMiss(board);
  assert.ok(nm);
  const offset = zeigarnikOffset(board, 0);
  assert.equal(anchorIndex(offset), nm.a, "the ache should sit at 12 o'clock");
});

test('zeigarnikOffset falls back to any adjacent pair, then to the closest pair', () => {
  const paired = b(_, c(1), c(1), _, _, _);
  assert.equal(anchorIndex(zeigarnikOffset(paired, 0)), 1);

  const apart = b(c(2), _, c(2), _, _, _);
  assert.equal(findAdjacentPair(apart), null);
  const closest = findClosestPair(apart);
  assert.ok(closest);
  assert.equal(anchorIndex(zeigarnikOffset(apart, 0)), closest.a);
});

test('zeigarnikOffset never touches piece identities', () => {
  const board = b(c(0), c(0), _, c(0), c(1), _);
  const before = codes(board);
  const offset = zeigarnikOffset(board, 3);
  assert.ok(offset >= 0 && offset < SLOTS);
  assert.equal(codes(board), before, 'rotation only — the board is frozen');
});

test('zeigarnikOffset gives up gracefully on a board with nothing to pair', () => {
  assert.equal(zeigarnikOffset(emptyBoard(), 4), 4);
  assert.equal(zeigarnikOffset(b(c(0), _, _, _, _, _), 2), 2);
});

/* ------------------------------------------------------------------ *
 * Render mirror
 * ------------------------------------------------------------------ */

test('slot codes round-trip', () => {
  assert.equal(encodeSlot(null), CODE_EMPTY);
  assert.equal(encodeSlot(P), CODE_PRISM);
  assert.equal(encodeSlot(c(2)), 2);
  assert.equal(decodeSlot(CODE_EMPTY), null);
  assert.deepEqual(decodeSlot(CODE_PRISM), { prism: true });
  assert.deepEqual(decodeSlot(1), { color: 1 });
});

test('maskOf builds a slot bitmask', () => {
  assert.equal(maskOf([]), 0);
  assert.equal(maskOf([0]), 1);
  assert.equal(maskOf([0, 1, 2]), 0b000111);
  assert.equal(maskOf([5, 0, 1]), 0b100011);
});

/* ------------------------------------------------------------------ *
 * Bag
 * ------------------------------------------------------------------ */

test('the bag is deterministic under a seed', () => {
  const a = createBag(seededRng(1234));
  const d = createBag(seededRng(1234));
  const left = Array.from({ length: 200 }, () => encodeSlot(a.draw()));
  const right = Array.from({ length: 200 }, () => encodeSlot(d.draw()));
  assert.deepEqual(left, right);
});

test('the bag keeps prisms rare and never doubles them up', () => {
  const bag = createBag(seededRng(99));
  const drawn = Array.from({ length: 4000 }, () => encodeSlot(bag.draw()));
  const prisms = drawn.filter((x) => x === CODE_PRISM).length;
  const rate = prisms / drawn.length;
  assert.ok(rate > PRISM_WEIGHT * 0.5, `prism rate ${rate} is too low`);
  assert.ok(rate < PRISM_WEIGHT * 1.5, `prism rate ${rate} is too high`);
  for (let i = 1; i < drawn.length; i++) {
    assert.ok(
      !(drawn[i] === CODE_PRISM && drawn[i - 1] === CODE_PRISM),
      `two prisms in a row at ${i}`,
    );
  }
});

test('the bag keeps the three colours in balance and damps streaks', () => {
  const bag = createBag(seededRng(7));
  const drawn = Array.from({ length: 6000 }, () => encodeSlot(bag.draw()));
  const colours = drawn.filter((x) => x !== CODE_PRISM);
  for (const colour of [0, 1, 2]) {
    const share = colours.filter((x) => x === colour).length / colours.length;
    assert.ok(share > 0.28 && share < 0.39, `colour ${colour} share ${share}`);
  }

  let quads = 0;
  for (let i = 3; i < colours.length; i++) {
    if (
      colours[i] === colours[i - 1] &&
      colours[i] === colours[i - 2] &&
      colours[i] === colours[i - 3]
    ) {
      quads++;
    }
  }
  // Uniform draws would give ~1/27 of positions; damping should beat that.
  assert.ok(quads / colours.length < 0.012, `four-in-a-row rate ${quads / colours.length}`);
});

test('the bag reads the board and tilts toward a colour that can be used', () => {
  // Two ambers with room to grow; amber is the colour that would merge.
  const board = b(c(1), c(1), _, _, _, _);
  const helped = createBag(seededRng(42));
  const blind = createBag(seededRng(42));

  const draws = 3000;
  let helpedAmber = 0;
  let blindAmber = 0;
  for (let i = 0; i < draws; i++) {
    if (encodeSlot(helped.draw({ board, helpfulness: 1 })) === 1) helpedAmber++;
    if (encodeSlot(blind.draw()) === 1) blindAmber++;
  }

  assert.ok(
    helpedAmber > blindAmber * 1.4,
    `steering too weak: ${helpedAmber} vs ${blindAmber}`,
  );
  // But never a guarantee — the other colours must keep showing up.
  assert.ok(helpedAmber < draws * 0.75, `steering too strong: ${helpedAmber}/${draws}`);
});

test('bag steering fades out as helpfulness drops', () => {
  const board = b(c(1), c(1), _, _, _, _);
  const count = (help: number) => {
    const bag = createBag(seededRng(7));
    let n = 0;
    for (let i = 0; i < 3000; i++) {
      if (encodeSlot(bag.draw({ board, helpfulness: help })) === 1) n++;
    }
    return n;
  };
  assert.ok(count(1) > count(0.2), 'full help should beat minimal help');
});

test('board reading agrees with the merge rules', () => {
  assert.equal(completesRun(b(c(0), c(0), _, _, _, _), c(0)), true);
  assert.equal(completesRun(b(c(0), c(0), _, _, _, _), c(1)), false);
  assert.equal(completesRun(b(c(0), c(0), _, _, _, _), P), true, 'a prism can finish it');
  assert.equal(completesRun(emptyBoard(), c(0)), false);

  assert.equal(hasLivePair(b(c(2), c(2), _, _, _, _), 2), true);
  assert.equal(hasLivePair(b(c(2), c(2), _, _, _, _), 0), false);
  // Walled in on both sides: the pair is dead, not live.
  assert.equal(hasLivePair(b(c(1), c(2), c(2), c(1), _, _), 2), false);

  assert.equal(hasColor(b(c(0), _, _, _, _, _), 0), true);
  assert.equal(hasColor(b(c(0), _, _, _, _, _), 1), false);
});

/* ------------------------------------------------------------------ *
 * Difficulty
 * ------------------------------------------------------------------ */

test('bag help decays with level but never runs out', () => {
  assert.equal(helpfulness(1), 1);
  let prev = Infinity;
  for (let level = 1; level <= 60; level++) {
    const h = helpfulness(level);
    assert.ok(h <= prev);
    assert.ok(h >= HELP_FLOOR, `level ${level} fell below the help floor`);
    prev = h;
  }
  assert.equal(helpfulness(60), HELP_FLOOR);
});

test('settle time shrinks with level and then stops', () => {
  assert.equal(settleMs(1), START_SETTLE_MS);
  let prev = Infinity;
  for (let level = 1; level <= 60; level++) {
    const ms = settleMs(level);
    assert.ok(ms <= prev, `level ${level} is not tighter than ${level - 1}`);
    assert.ok(ms >= FLOOR_SETTLE_MS, `level ${level} dropped below the floor`);
    prev = ms;
  }
  assert.equal(settleMs(60), FLOOR_SETTLE_MS);
  assert.equal(settleMs(0), START_SETTLE_MS, 'level is clamped from below');
});

test('level is derived from merges, so a chain cannot skip one', () => {
  assert.equal(levelForMerges(0), 1);
  assert.equal(levelForMerges(MERGES_PER_LEVEL - 1), 1);
  assert.equal(levelForMerges(MERGES_PER_LEVEL), 2);
  assert.equal(levelForMerges(MERGES_PER_LEVEL * 2), 3);
  // A three-chain lands on merge 7 -> 10 and must not leap past level 2.
  assert.equal(levelForMerges(10), 2);
});

/* ------------------------------------------------------------------ *
 * Exhaustive invariants over every reachable board
 * ------------------------------------------------------------------ */

/** All 5^6 boards: each slot empty, one of three colours, or a prism. */
function* allBoards(): Generator<Board> {
  const alphabet = [CODE_EMPTY, 0, 1, 2, CODE_PRISM];
  const total = alphabet.length ** SLOTS;
  for (let n = 0; n < total; n++) {
    const board = emptyBoard();
    let x = n;
    for (let i = 0; i < SLOTS; i++) {
      board[i] = decodeSlot(alphabet[x % alphabet.length]);
      x = Math.floor(x / alphabet.length);
    }
    yield board;
  }
}

test('every board resolves to a stable ring without losing or inventing pieces', () => {
  let seen = 0;
  let maxChain = 0;

  for (const board of allBoards()) {
    seen++;
    const before = occupied(board);
    const res = resolve(board);

    assert.ok(res.steps.length <= 2, 'a six-slot ring cannot chain more than twice');
    assert.equal(findMatch(res.board), null, `resolve left a match in ${codes(board)}`);

    let cleared = 0;
    let condensed = 0;
    for (const step of res.steps) {
      cleared += step.run.len;
      if (step.residue >= 0) {
        condensed++;
        assert.ok(step.run.len >= PRISM_RUN_LENGTH, 'short runs must not pay a prism');
        assert.equal(encodeSlot(step.boardAfter[step.residue]), CODE_PRISM);
      }
      assert.equal(step.indices.length, step.run.len);
      for (const t of step.travel) {
        assert.ok(t >= 0 && t < SLOTS, `travel ${t} out of range for ${codes(board)}`);
      }
    }
    assert.equal(
      occupied(res.board),
      before - cleared + condensed,
      `piece count drifted on ${codes(board)}`,
    );
    assert.equal(res.scoreGained, chainScore(res.chain));
    maxChain = Math.max(maxChain, res.chain);
  }

  assert.equal(seen, 5 ** SLOTS);
  assert.equal(maxChain, 2, 'the two-chain must actually be reachable');
});

test('collapse always conserves survivors and only ever moves them counter-clockwise', () => {
  for (const board of allBoards()) {
    const run = findMatch(board);
    if (!run) continue;

    const out = collapse(board, run);
    const survivorsBefore: number[] = [];
    for (let d = run.len; d < SLOTS; d++) {
      const s = board[mod(run.start + d, SLOTS)];
      if (s !== null) survivorsBefore.push(encodeSlot(s));
    }
    // Read the result clockwise from the run's own start, not from index 0 —
    // the packed block can straddle the seam.
    let survivorsAfter: number[] = [];
    for (let d = 0; d < SLOTS; d++) {
      const s = out.board[mod(run.start + d, SLOTS)];
      if (s !== null) survivorsAfter.push(encodeSlot(s));
    }
    if (out.residue >= 0) {
      // The condensed prism leads the packed block; everything behind it is
      // still the untouched survivor sequence.
      assert.equal(survivorsAfter[0], CODE_PRISM, `missing prism on ${codes(board)}`);
      survivorsAfter = survivorsAfter.slice(1);
    }

    assert.deepEqual(
      survivorsAfter.slice().sort(),
      survivorsBefore.slice().sort(),
      `survivors changed on ${codes(board)}`,
    );
    // Clockwise order is preserved, starting from the run's own start index.
    assert.deepEqual(survivorsAfter, survivorsBefore, `order scrambled on ${codes(board)}`);
  }
});

test('a reported near miss is always genuinely two-and-a-reachable-third', () => {
  for (const board of allBoards()) {
    const nm = findNearMiss(board);
    if (!nm) continue;

    assert.equal(nm.b, mod(nm.a + 1, SLOTS));
    const distance = mod(nm.third - nm.a, SLOTS);
    assert.ok(distance === 3 || distance === 4, `third at distance ${distance}`);
    for (const i of [nm.a, nm.b, nm.third]) {
      assert.notEqual(board[i], null);
    }
    // All three genuinely share the reported colour.
    for (const i of [nm.a, nm.b, nm.third]) {
      assert.ok(compatible(board[i], nm.color), `slot ${i} does not match ${nm.color}`);
    }
    // The pair is exactly two: extending it either way must fail.
    assert.equal(compatible(board[mod(nm.a - 1, SLOTS)], nm.color), false);
    assert.equal(compatible(board[mod(nm.b + 1, SLOTS)], nm.color), false);
  }
});

test('zeigarnikOffset always frames an occupied slot when a pair exists', () => {
  for (const board of allBoards()) {
    if (!findClosestPair(board)) continue;
    const offset = zeigarnikOffset(board, 0);
    assert.ok(offset >= 0 && offset < SLOTS);
    assert.notEqual(
      board[anchorIndex(offset)],
      null,
      `anchored on an empty slot for ${codes(board)}`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * Chain scale
 * ------------------------------------------------------------------ */

test('each link of a chain sounds the next degree of the scale', () => {
  assert.equal(noteForChain(0), CHAIN_SCALE[0]);
  assert.equal(noteForChain(1), CHAIN_SCALE[1]);
  assert.equal(noteForChain(2), CHAIN_SCALE[2]);

  // Rising, so a cascade walks up rather than wandering.
  for (let i = 1; i < CHAIN_SCALE.length; i++) {
    assert.ok(noteForChain(i) > noteForChain(i - 1), `degree ${i} is not higher`);
  }

  // Out-of-range links clamp rather than returning undefined: resolve() can
  // only reach chain 2 today, but the sound must not break if that changes.
  assert.equal(noteForChain(99), CHAIN_SCALE[CHAIN_SCALE.length - 1]);
  assert.equal(noteForChain(-3), CHAIN_SCALE[0]);
});
