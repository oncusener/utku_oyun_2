/**
 * feedback.ts — haptics, optional sound, and every timing constant in the game.
 *
 * Timings live here rather than next to the animations that use them because
 * they are a single designed rhythm, not six independent numbers. Reading them
 * as a column is the only way to tell whether the game breathes.
 *
 * Everything is fire-and-forget. A haptic that fails on an unsupported device
 * must never interrupt a frame, so the promises are swallowed on purpose.
 */

import * as Haptics from 'expo-haptics';

import { playTone } from './sound';

export { CHAIN_SCALE, noteForChain } from './scale';

export const TIMING = {
  /** Ring snap to the next 60deg detent. */
  SNAP_MS: 110,
  /** Active piece travelling from centre to the anchor slot. */
  DROP_MS: 140,
  /** Beat between the piece landing and the board being read for merges. */
  POST_DROP_MS: 60,
  /** A cleared run expanding and fading out. */
  BURST_MS: 260,
  /** Survivors sliding counter-clockwise into the hole. */
  COLLAPSE_MS: 180,
  /** Pause between one link of a chain and the next. */
  CHAIN_GAP_MS: 180,
  /** Second tap of the chain haptic. */
  CHAIN_HAPTIC_GAP_MS: 60,

  /** Near miss: wait, lean in, lean back. */
  NEAR_MISS_DELAY_MS: 120,
  NEAR_MISS_RISE_MS: 180,
  NEAR_MISS_FALL_MS: 180,

  /** Game over: rotate the board to frame the near-merge, hold, then leave. */
  GAME_OVER_TURN_MS: 260,
  GAME_OVER_HOLD_MS: 700,
  CROSS_FADE_MS: 400,
} as const;

/** How far the two near-miss pieces lean toward each other. */
export const NEAR_MISS_SHIFT_PX = 3;
/** How much brighter they get while leaning. */
export const NEAR_MISS_BRIGHTEN = 0.18;

let hapticsEnabled = true;
export function setHapticsEnabled(on: boolean): void {
  hapticsEnabled = on;
}

function impact(style: Haptics.ImpactFeedbackStyle): void {
  if (!hapticsEnabled) return;
  // Deliberately not awaited: this is called from gesture callbacks and must
  // not add a microtask to the drag path.
  void Haptics.impactAsync(style).catch(() => {});
}

/** One detent of rotation. The smallest thing the game says. */
export function stepTick(): void {
  impact(Haptics.ImpactFeedbackStyle.Light);
}

/** A run clearing. */
export function mergeThud(): void {
  impact(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Two or more links in one resolve: a light double-tap, 60ms apart.
 * Distinct from the single medium thud of the merges themselves, so a chain is
 * legible through a coat pocket.
 */
export function chainFlourish(): void {
  impact(Haptics.ImpactFeedbackStyle.Light);
  setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Light), TIMING.CHAIN_HAPTIC_GAP_MS);
}

/* ------------------------------------------------------------------ *
 * Sound
 * ------------------------------------------------------------------ */

/**
 * A minor pentatonic scale, one degree per link of the chain, so a long cascade
 * walks up the scale and resolves. Nothing plays on a failed drop and nothing
 * plays on a near miss — the near miss is deliberately silent so it registers
 * as a feeling rather than an event.
 *
 * The tones themselves live in sound.ts; this file keeps the mapping because
 * the mapping is a design decision and belongs beside the timings.
 */

export function playNote(chainIndex: number): void {
  playTone(chainIndex);
}
