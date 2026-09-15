/**
 * scale.ts — which note a link of a chain sounds.
 *
 * Kept apart from feedback.ts, and free of every import, for the same reason
 * policy.ts is kept apart from the ad SDK: this is a design decision worth
 * testing, and it cannot be tested from a file that reaches for expo-haptics
 * and expo-audio. Those do not load under plain Node, and the engine suite runs
 * with no bundler at all.
 */

/** Minor pentatonic degrees, in semitones from the root. */
export const CHAIN_SCALE = [0, 3, 5, 7, 10, 12] as const;

/**
 * The degree a given link sounds, clamped at both ends. resolve() can only
 * reach a two-chain today, but a tone that returns undefined for link three
 * would be a silent failure the moment that changes.
 */
export function noteForChain(chainIndex: number): number {
  const clamped = Math.max(0, Math.min(chainIndex, CHAIN_SCALE.length - 1));
  return CHAIN_SCALE[clamped];
}
