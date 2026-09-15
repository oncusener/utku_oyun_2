/**
 * bag.ts — weighted piece generator.
 *
 * Pure apart from the injected `rng`, so tests can seed it and get the same
 * sequence every time.
 *
 * The weighting is doing emotional work, not mathematical work. A true uniform
 * draw produces streaks, and a streak on a six-slot ring reads as the game
 * being unfair right when the player is standing on a moving train. So a colour
 * that just came up twice gets damped, and a colour that has been missing for a
 * while gets nudged back in.
 */

// Explicit .ts extension: engine.test.ts runs under `node --test`, which loads
// this file directly and needs a resolvable specifier. Metro and tsc both
// accept it (tsconfig sets allowImportingTsExtensions).
import { completesRun, hasColor, hasLivePair } from './engine.ts';
import type { Board, Color, Piece } from './engine.ts';

export type Rng = () => number;

/**
 * What the bag is allowed to know when it draws.
 *
 * `helpfulness` scales every board-aware boost, so difficulty is expressed as
 * how much luck the game is willing to arrange on your behalf. Omit the context
 * entirely and the bag falls back to blind weighting.
 */
export type BagContext = { board: Board; helpfulness: number };

export type Bag = {
  draw: (ctx?: BagContext) => Piece;
  reset: () => void;
};

/** Base share of draws that are prisms. Rare enough to feel like weather. */
export const PRISM_WEIGHT = 0.045;

/** Weight multiplier for a colour that already came up in the last two draws. */
const REPEAT_DAMP = 0.34;

/** Weight multiplier for a colour absent from the last DROUGHT_WINDOW draws. */
const DROUGHT_BOOST = 1.9;
const DROUGHT_WINDOW = 6;

/** Extra weight, at full helpfulness, for a colour that would merge right now. */
const MERGE_BOOST = 2.4;
/** Extra weight for a colour that has a pair on the board with room to grow. */
const PAIR_BOOST = 1.0;
/**
 * Extra weight for a colour merely present on the board.
 *
 * Without this the bag is blind for the opening few drops — there are no pairs
 * yet to steer toward — and that is exactly where the unrecoverable games were
 * being lost.
 */
const SEED_BOOST = 0.55;

const COLORS: Color[] = [0, 1, 2];

/** mulberry32 — small, fast, good enough, and identical across platforms. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBag(rng: Rng = Math.random): Bag {
  /** Most recent draws, newest first. Prisms are recorded as -1. */
  let history: number[] = [];

  const remember = (code: number) => {
    history.unshift(code);
    if (history.length > DROUGHT_WINDOW) history.pop();
  };

  const draw = (ctx?: BagContext): Piece => {
    // Two prisms in a row would blow the ring open; never allow it.
    if (history[0] !== -1 && rng() < PRISM_WEIGHT) {
      remember(-1);
      return { prism: true };
    }

    const help = ctx ? Math.max(0, Math.min(1, ctx.helpfulness)) : 0;

    const weights = COLORS.map((c) => {
      let w = 1;
      if (history[0] === c && history[1] === c) w *= REPEAT_DAMP;
      if (!history.includes(c) && history.length >= DROUGHT_WINDOW) w *= DROUGHT_BOOST;

      // Tilt toward a colour the player can actually use. Not a guarantee —
      // the other colours keep their full base weight, so the tilt reads as
      // luck rather than as the game playing itself.
      if (ctx && help > 0) {
        if (completesRun(ctx.board, { color: c })) w *= 1 + MERGE_BOOST * help;
        else if (hasLivePair(ctx.board, c)) w *= 1 + PAIR_BOOST * help;
        else if (hasColor(ctx.board, c)) w *= 1 + SEED_BOOST * help;
      }
      return w;
    });

    const total = weights[0] + weights[1] + weights[2];
    let roll = rng() * total;
    for (let i = 0; i < COLORS.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        remember(COLORS[i]);
        return { color: COLORS[i] };
      }
    }

    // Floating point ran out of road; take the last colour.
    remember(COLORS[COLORS.length - 1]);
    return { color: COLORS[COLORS.length - 1] };
  };

  return {
    draw,
    reset: () => {
      history = [];
    },
  };
}
