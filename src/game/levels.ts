/**
 * levels.ts — what a level asks of you, and whether you did it.
 *
 * Halka began as an endless score run. The research brief is blunt about why
 * that structure lost: a score with no stated goal gives the player nothing to
 * aim at and nothing to come back for. So a level now states an objective, and
 * the ring decides how long you have to reach it.
 *
 * The one structural decision worth naming: **there is no move limit — the
 * ring is the clock.** The Stitch screens proposed one ("KALAN HAMLE", "+3
 * HAMLE"), and it was built and simulated before being taken out again. On a
 * six-slot ring it can never bind: with the budget set anywhere near fair, the
 * ring fills before the moves run out, every time. Measured across levels, 150
 * losses to a full ring for every 0 to an empty budget. A counter that never
 * reaches zero is decoration, and worse, it tells the player they are safe
 * right up until they lose to something it never showed them.
 *
 * So a level is "make these merges before the ring fills" — which is exactly
 * the tension Halka always had, now with a stated goal. Every drop adds a piece
 * and only a merge takes pieces away, so a level cannot be stalled: it ends in
 * a win or a full ring. Drops still count, but toward stars, not failure.
 *
 * The settle timer stays. It was taken out of level mode once, on the theory
 * that a puzzle should let you think as long as you like, and the game went
 * slack: with all the time in the world every drop can be checked against
 * every rotation, and the ring stops being something you play with your thumb.
 * So the arc still runs down and still drops the piece for you — generous on
 * the first levels, tighter as they climb — and running out of time costs you
 * control of where the piece goes, never the level (see Game.tsx, commitDrop).
 *
 * Levels are generated rather than authored. A hundred hand-made levels is a
 * content pipeline this project does not have, and the brief recommends a
 * generator with a difficulty ramp. Every level is a pure function of its
 * number, so there is no data file to ship, no level can be missing, and the
 * whole curve can be re-tuned by editing arithmetic.
 *
 * Pure: no React, no storage, no randomness beyond the seed it is handed.
 */

import { emptyBoard, isBoardFull, isPrism } from './engine.ts';
import type { Board, Color, ResolveResult } from './engine.ts';

export const REGION_SIZE = 12;

/** One line of instruction, shown the first time an idea appears. */
export type Lesson = 'merge' | 'rotate' | 'colour' | 'prism';

/**
 * There is deliberately no "make a chain" objective. It was tried: a two-chain
 * needs a four-run to condense a prism beside a surviving pair, and within a
 * fixed move budget that is luck, not skill — simulated win rates of 4-7%, or
 * fourteen to twenty-eight attempts. The brief's test for a fair level is that
 * the player can see what they did wrong, and nobody can see why a chain did
 * not happen.
 */
export type Objective =
  | { kind: 'merges'; count: number }
  | { kind: 'colour'; colour: Color; count: number }
  | { kind: 'prisms'; count: number };

export type LevelSpec = {
  id: number;
  region: number;
  /** Position within the region, 1-based. */
  slot: number;
  /** Drops for three stars. A target to beat, never a limit. */
  par: number;
  objectives: Objective[];
  /** Seeds the bag, so a level plays the same for everyone. */
  seed: number;
  reward: number;
  /** Shown on the map; a level that asks for more than the usual. */
  hard: boolean;
  /** A ring laid out in advance, for the levels that teach something. */
  start: Board;
  /** The one idea a teaching level exists to introduce, as an i18n key. */
  lesson?: Lesson;
  /** How much luck the bag arranges, 0..1. See levelHelp. */
  help: number;
  /** Thinking time per piece, in ms, before the arc drops it. See levelSettleMs. */
  settle: number;
};

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

/**
 * Difficulty ramp.
 *
 * The brief's guidance is a slow rise with regular breathing room, not a
 * staircase: the opening levels should be near-certain wins that teach one
 * thing each, then a sawtooth where every few levels a harder one lands and is
 * followed by an easier one. `hard` is that sawtooth, and it deliberately never
 * lands on the first level of a region — arriving somewhere new should not
 * immediately punish you.
 */
function isHard(id: number): boolean {
  if (id <= 6) return false;
  return id % 5 === 0 && id % REGION_SIZE !== 1;
}

/**
 * The opening levels, laid out by hand. Everything after is generated.
 *
 * Simulation showed why these are needed: the first levels sat at 86% and did
 * not move when given more moves, because the losses were not from running out
 * of moves but from the ring filling while the player was still finding their
 * first three. A pre-set ring removes that, and lets each level teach exactly
 * one thing. The anchor is over slot 0, so where a pair sits relative to slot 0
 * decides whether the lesson needs a rotation at all.
 */
function teachingBoard(id: number): { start: Board; lesson?: LevelSpec['lesson'] } {
  const b = emptyBoard();
  switch (id) {
    case 1:
      // A pair right beside the anchor: drop, and it merges. Nothing to learn
      // but that three of a colour make a merge.
      b[1] = { color: 0 };
      b[2] = { color: 0 };
      return { start: b, lesson: 'merge' };
    case 2:
      // The pair is round the back of the ring. You cannot finish it without
      // turning the ring, and that is the whole lesson.
      b[3] = { color: 1 };
      b[4] = { color: 1 };
      return { start: b, lesson: 'rotate' };
    case 3:
      // Two pairs of two colours: the first level that asks for a choice.
      b[1] = { color: 0 };
      b[2] = { color: 0 };
      b[4] = { color: 2 };
      b[5] = { color: 2 };
      return { start: b };
    default:
      return { start: b };
  }
}

/**
 * How generous the bag is on a given level.
 *
 * Endless mode tightens the bag as you climb because it has no other lever.
 * Level mode has the objective, so the bag only eases off slowly: fully kind
 * for the first ten levels, never below 0.55 after. Tightened faster, late
 * levels turned into a draw you could not play your way out of — the ring
 * filled with colours that had no partner, and the player lost to the bag
 * rather than to a decision. The demand ramp in baseDemand carries most of the
 * difficulty instead, because "you needed six merges and made five" is a loss
 * the player can read.
 */
function levelHelp(id: number): number {
  if (id <= 10) return 1;
  return Math.max(0.55, 1 - (id - 10) * 0.012);
}

/**
 * Thinking time per piece.
 *
 * Endless starts at 6.5s and loses 7% a level, because its levels come every
 * eight merges and a run is meant to end. Levels are longer-lived and are lost
 * to the ring, not the clock, so the time comes down far more slowly — 2.5% a
 * level — and stops at 3s rather than endless's 2.4s: enough to look up at a
 * station sign and back.
 */
export const LEVEL_SETTLE_START_MS = 6500;
export const LEVEL_SETTLE_FLOOR_MS = 3000;
const LEVEL_SETTLE_DECAY = 0.975;

export function levelSettleMs(id: number): number {
  const raw = LEVEL_SETTLE_START_MS * Math.pow(LEVEL_SETTLE_DECAY, Math.max(0, id - 1));
  return Math.max(LEVEL_SETTLE_FLOOR_MS, Math.round(raw));
}

/** How many merges a level asks for, before objective-specific adjustment. */
function baseDemand(id: number): number {
  if (id <= 2) return 1;
  if (id <= 5) return 2;
  if (id <= 10) return 3;
  return Math.min(8, 3 + Math.floor((id - 10) / 8));
}

/**
 * Par: the drop count that earns three stars.
 *
 * Calibrated, not reasoned. The first formula (3.6 drops per merge) was a
 * guess, and simulated it handed three stars to 81% of wins, which makes stars
 * meaningless. These constants are fitted to the drops that the most efficient
 * third of simulated wins actually used, so three stars means the same thing on
 * level 4 as on level 60: you played better than most.
 *
 * Colour targets need their own line. They are counted in pieces, and clearing
 * n pieces of one colour costs about 2.1n drops — which the old formula, by
 * converting pieces to merges, got wrong by roughly half.
 */
function parFor(objectives: Objective[]): number {
  let par = 0;
  for (const o of objectives) {
    if (o.kind === 'merges') par = Math.max(par, Math.round(3.15 * o.count + 0.5));
    if (o.kind === 'colour') par = Math.max(par, Math.round(2.1 * o.count));
  }
  // Setting up a four-run on purpose costs a couple of drops of patience.
  if (objectives.some((o) => o.kind === 'prisms')) par += 2;
  return Math.max(3, par);
}

/** Three stars at par, two within a margin that widens with the level. */
function twoStarLimit(par: number): number {
  return par + Math.max(2, Math.round(par * 0.15));
}

export function levelSpec(id: number): LevelSpec {
  if (!Number.isInteger(id) || id < 1) {
    throw new RangeError(`level id must be a positive integer, got ${id}`);
  }

  const region = Math.floor((id - 1) / REGION_SIZE) + 1;
  const slot = ((id - 1) % REGION_SIZE) + 1;
  const hard = isHard(id);
  const demand = baseDemand(id) + (hard ? 1 : 0);

  const objectives: Objective[] = [];

  // The opening levels ask only for merges: one idea at a time.
  if (id <= 5) {
    objectives.push({ kind: 'merges', count: demand });
  } else if (id % 4 === 2) {
    // A colour objective, rotating so no single colour dominates a region. The
    // count is pieces, and one merge clears three, so demand+1 pieces is a
    // little over a third of the merges a plain level would ask for.
    objectives.push({
      kind: 'colour',
      colour: ((id / 2) % 3) as Color,
      count: demand + 1,
    });
  } else if (id % 7 === 0) {
    // Prisms can only come from a four-run, so this is the level that asks the
    // player to set one up on purpose. Never more than one at a time.
    objectives.push({ kind: 'merges', count: demand });
    objectives.push({ kind: 'prisms', count: 1 });
  } else {
    objectives.push({ kind: 'merges', count: demand });
  }

  const par = parFor(objectives);

  const { start, lesson } = teachingBoard(id);

  return {
    id,
    region,
    slot,
    par,
    objectives,
    seed: id * 7919 + 13,
    reward: 20 + (hard ? 30 : 0) + Math.floor(id / 4) * 5,
    hard,
    start,
    lesson,
    help: levelHelp(id),
    settle: levelSettleMs(id),
  };
}

/* ------------------------------------------------------------------ *
 * Playing a level
 * ------------------------------------------------------------------ */

export type LevelProgress = {
  /** Pieces dropped so far. Counts up; only stars care. */
  drops: number;
  merges: number;
  /** Pieces cleared, indexed by colour. Prisms are not a colour. */
  cleared: [number, number, number];
  prisms: number;
  bestChain: number;
  score: number;
};

export function newProgress(spec: LevelSpec): LevelProgress {
  return {
    drops: 0,
    merges: 0,
    cleared: [0, 0, 0],
    prisms: 0,
    bestChain: 0,
    score: 0,
  };
}

/** How far along one objective is. Never reports more than it needs. */
export function objectiveDone(objective: Objective, p: LevelProgress): number {
  switch (objective.kind) {
    case 'merges':
      return Math.min(p.merges, objective.count);
    case 'colour':
      return Math.min(p.cleared[objective.colour], objective.count);
    case 'prisms':
      return Math.min(p.prisms, objective.count);
  }
}

export function objectiveComplete(objective: Objective, p: LevelProgress): boolean {
  return objectiveDone(objective, p) >= objective.count;
}

export function levelComplete(spec: LevelSpec, p: LevelProgress): boolean {
  return spec.objectives.every((o) => objectiveComplete(o, p));
}

/**
 * The ring filled before the objectives were met. Checked after a move has
 * fully resolved, so a drop that fills the last slot but completes a merge is a
 * win, not a loss.
 */
export function levelFailed(spec: LevelSpec, p: LevelProgress, board: Board): boolean {
  return isBoardFull(board) && !levelComplete(spec, p);
}

/**
 * Overall completion, 0..1 — the number on the "almost" screen.
 *
 * Averaged across objectives rather than summed, so a level with two objectives
 * cannot read 94% while one of them sits untouched.
 */
export function completion(spec: LevelSpec, p: LevelProgress): number {
  if (spec.objectives.length === 0) return 1;
  const total = spec.objectives.reduce((sum, o) => sum + objectiveDone(o, p) / o.count, 0);
  return Math.min(1, total / spec.objectives.length);
}

/**
 * Fold one move into a level's progress.
 *
 * `dropped` is the board immediately after the piece landed and before any
 * merge — the only board on which the first run's pieces can still be read.
 * Each later step is read from the previous step's result, which is why the
 * colours cleared cannot be recovered from the final board alone.
 *
 * Prisms caught up in a run are not a colour and count toward no colour
 * objective; a prism condensed out of a four-run counts toward `prisms`.
 */
export function applyMove(
  p: LevelProgress,
  dropped: Board,
  res: ResolveResult,
): LevelProgress {
  const cleared: [number, number, number] = [...p.cleared];
  let prisms = p.prisms;
  let before = dropped;

  for (const step of res.steps) {
    for (const i of step.indices) {
      const piece = before[i];
      if (piece && !isPrism(piece)) cleared[piece.color]++;
    }
    if (step.residue >= 0) prisms++;
    before = step.boardAfter;
  }

  return {
    drops: p.drops + 1,
    merges: p.merges + res.chain,
    cleared,
    prisms,
    bestChain: Math.max(p.bestChain, res.chain),
    score: p.score + res.scoreGained,
  };
}

/** Stars, 1–3, from drops used against par. Only meaningful for a win. */
export function stars(spec: LevelSpec, p: LevelProgress): 1 | 2 | 3 {
  if (p.drops <= spec.par) return 3;
  if (p.drops <= twoStarLimit(spec.par)) return 2;
  return 1;
}

/** The colour this level wants collected, if any — handed to the bag. */
export function focusColour(spec: LevelSpec): Color | undefined {
  const colour = spec.objectives.find((o) => o.kind === 'colour');
  return colour && colour.kind === 'colour' ? colour.colour : undefined;
}

/**
 * The first level whose objectives include `kind`. The generator decides where
 * each idea first appears, so this asks it rather than hard-coding the answer
 * in the HUD, where it would go stale the moment the ramp was re-tuned.
 */
export function firstLevelWith(kind: Objective['kind']): number {
  for (let id = 1; id <= 1000; id++) {
    if (levelSpec(id).objectives.some((o) => o.kind === kind)) return id;
  }
  return -1;
}

const firstColourLevel = firstLevelWith('colour');
const firstPrismLevel = firstLevelWith('prisms');

/**
 * What to teach on this level, if anything: the hand-made opening lessons, then
 * one line the first time a new kind of objective turns up. Every idea is
 * explained exactly once, at the moment it first matters.
 */
export function lessonFor(spec: LevelSpec): Lesson | undefined {
  if (spec.lesson) return spec.lesson;
  if (spec.id === firstColourLevel) return 'colour';
  if (spec.id === firstPrismLevel) return 'prism';
  return undefined;
}
