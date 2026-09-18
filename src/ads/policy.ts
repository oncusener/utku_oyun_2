/**
 * policy.ts — when an ad is allowed to interrupt.
 *
 * This is a design document that happens to compile. Halo is meant to be
 * played standing on a subway and put down without a thought, so an ad that
 * fires on the first game over, or on every game over, would break the one
 * thing the game is for. The rules:
 *
 *   - never on the first sessions; let someone learn the ring in peace
 *   - then at most one interstitial every few sessions
 *   - and never twice inside the cooldown, however many sessions elapse
 *
 * Rewarded ads are exempt because the player asks for them by name.
 *
 * Kept free of React and of the ad SDK so the rules can be unit-tested.
 */

export const GRACE_SESSIONS = 2;
export const SESSIONS_PER_INTERSTITIAL = 3;
export const COOLDOWN_MS = 120_000;

export type PolicyState = {
  sessions: number;
  lastShownAt: number | null;
};

export function newPolicyState(): PolicyState {
  return { sessions: 0, lastShownAt: null };
}

export function recordSession(state: PolicyState): PolicyState {
  return { ...state, sessions: state.sessions + 1 };
}

export function recordShown(state: PolicyState, now: number): PolicyState {
  return { ...state, lastShownAt: now };
}

export function shouldShowInterstitial(state: PolicyState, now: number): boolean {
  if (state.sessions <= GRACE_SESSIONS) return false;
  if (state.sessions % SESSIONS_PER_INTERSTITIAL !== 0) return false;
  if (state.lastShownAt !== null && now - state.lastShownAt < COOLDOWN_MS) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Choosing between the two ad paths
 * ------------------------------------------------------------------ */

export type AdMoment = 'interstitial' | 'revive' | 'none';

export type MomentInput = {
  policy: PolicyState;
  /** Is a rewarded ad loaded and ready to present right now? */
  rewardLoaded: boolean;
  /** Has this run already been continued once? */
  alreadyRevived: boolean;
};

/**
 * Which ad, if either, belongs at this game over.
 *
 * The order here is the whole point, and it was wrong the first time. The
 * original rule was "offer the revive, and show an interstitial only if there
 * is no revive to offer" — which reads as courteous and is, in practice, a
 * switch that turns interstitials off forever: a rewarded ad is nearly always
 * preloaded, and every fresh run resets the once-per-run flag, so the revive
 * was always on offer and the interstitial never ran. Written, tested in
 * isolation, unreachable in play.
 *
 * So the interruption budget decides first. If the cadence and cooldown say an
 * interstitial is due, it takes the slot; otherwise the revive is offered. Both
 * paths stay live, they never both fire at once, and the budget in
 * shouldShowInterstitial still caps how often the player is interrupted.
 */
export function chooseAdMoment(input: MomentInput, now: number): AdMoment {
  if (shouldShowInterstitial(input.policy, now)) return 'interstitial';
  if (input.rewardLoaded && !input.alreadyRevived) return 'revive';
  return 'none';
}
