/**
 * difficulty.ts — level -> settle duration.
 *
 * The only thing that tightens is the settle timer. Nothing speeds up, nothing
 * gets added, no new mechanic arrives at level 9. On a subway platform the
 * player should be able to put the phone away mid-level without feeling they
 * abandoned a system they had just learned.
 *
 * The floor matters more than the curve: 2.4s is still enough time to look up,
 * check the stop, and look back down.
 */

export const START_SETTLE_MS = 6500;
export const FLOOR_SETTLE_MS = 2400;

/** Each level keeps 93% of the previous level's thinking time. */
export const DECAY = 0.93;

export const MERGES_PER_LEVEL = 8;

export function settleMs(level: number): number {
  const l = Math.max(1, Math.floor(level));
  const raw = START_SETTLE_MS * Math.pow(DECAY, l - 1);
  return Math.max(FLOOR_SETTLE_MS, Math.round(raw));
}

/**
 * Derived rather than incremented. The spec's `merges % 8 == 0` is the same
 * thing when merges rise one at a time, but a three-chain adds three at once
 * and the modulo test would skip the level entirely.
 */
export function levelForMerges(merges: number): number {
  return 1 + Math.floor(Math.max(0, merges) / MERGES_PER_LEVEL);
}

/** The level at which the settle timer stops shrinking. */
export function floorLevel(): number {
  return Math.ceil(Math.log(FLOOR_SETTLE_MS / START_SETTLE_MS) / Math.log(DECAY)) + 1;
}

/**
 * How much the bag is allowed to help, from 1 (very generous) down to a floor.
 *
 * This is the real difficulty curve. The settle timer was never what killed
 * anybody — six slots fill up long before anyone runs out of thinking time — so
 * tightening only the clock made the game harsher along the one axis that was
 * not the problem. Luck is the axis that matters, so that is the one that
 * tightens.
 *
 * It never reaches zero. A game you play standing on a train should not end
 * because the bag decided to hand you four unusable pieces in a row.
 */
export const HELP_FLOOR = 0.18;
export const HELP_DECAY_PER_LEVEL = 0.09;

export function helpfulness(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return Math.max(HELP_FLOOR, 1 - (l - 1) * HELP_DECAY_PER_LEVEL);
}
