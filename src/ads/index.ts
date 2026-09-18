/**
 * ads — the whole surface the game is allowed to touch.
 *
 * Every function here is safe to call when there is no AdMob at all: in Expo
 * Go, on web, on a device where initialisation failed, or when the network is
 * gone. They resolve to `false` and the game carries on. Nothing in Game.tsx or
 * SessionEnd.tsx knows whether ads exist.
 *
 * Ads are preloaded in the background and shown from an already-loaded object,
 * because a spinner between "game over" and "here is your score" is exactly the
 * kind of friction this game is supposed not to have. If the preload has not
 * finished, the moment passes and the ad is simply skipped.
 */

import {
  interstitialUnitId,
  rewardedInterstitialUnitId,
  servingLiveAds,
} from './adUnits.ts';
import { resolveConsent, showPrivacyOptions } from './consent.ts';
import { loadAdsNative } from './native.ts';
import {
  chooseAdMoment,
  newPolicyState,
  recordSession,
  recordShown,
} from './policy.ts';
import type { AdMoment, PolicyState } from './policy.ts';

type Status = 'idle' | 'initialising' | 'ready' | 'unavailable';

let status: Status = 'idle';
let policy: PolicyState = newPolicyState();

/** Whether personalised ads may be requested. Decided once by the consent flow
 *  in initAds(); false until then, and whenever consent is denied or absent. */
let personalizedAds = false;
let canShowPrivacyOptions = false;

/** Preloaded ad objects, or null while unloaded. Typed loosely: the SDK's own
 *  types are only available when the native module resolved. */
let interstitial: any = null;
let rewarded: any = null;

export function adsAvailable(): boolean {
  return status === 'ready';
}

export function adsServingLive(): boolean {
  return servingLiveAds();
}

/** True when the consent flow permitted personalised ad requests. */
export function personalizedAdsAllowed(): boolean {
  return personalizedAds;
}

/** True when a "privacy options" entry point should be offered (EEA users);
 *  wire showPrivacyOptions() to it. */
export function privacyOptionsAvailable(): boolean {
  return canShowPrivacyOptions;
}

export { showPrivacyOptions };

/**
 * Bring the SDK up. Resolves false — without throwing — when there is nothing
 * to bring up, which is the normal case in Expo Go.
 */
export async function initAds(): Promise<boolean> {
  if (status === 'ready') return true;
  if (status === 'unavailable' || status === 'initialising') return false;

  const native = loadAdsNative();
  if (!native) {
    status = 'unavailable';
    return false;
  }

  status = 'initialising';
  try {
    // Gather consent (UMP, then iOS ATT) before any ad is requested — that
    // order is required by Google. A failure here is never fatal: resolveConsent
    // falls back to non-personalised ads, which is what the rest of this layer
    // already assumes.
    const consent = await resolveConsent(native);
    personalizedAds = consent.personalizedAds;
    canShowPrivacyOptions = consent.canShowPrivacyOptions;

    await native.default().setRequestConfiguration({
      maxAdContentRating: native.MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await native.default().initialize();
    status = 'ready';
    preloadInterstitial();
    preloadRewarded();
    return true;
  } catch {
    status = 'unavailable';
    return false;
  }
}

function preloadInterstitial(): void {
  const native = loadAdsNative();
  if (!native || status !== 'ready' || interstitial) return;

  try {
    const ad = native.InterstitialAd.createForAdRequest(interstitialUnitId(), {
      requestNonPersonalizedAdsOnly: !personalizedAds,
    });
    ad.addAdEventListener(native.AdEventType.ERROR, () => {
      interstitial = null;
    });
    ad.addAdEventListener(native.AdEventType.CLOSED, () => {
      interstitial = null;
      preloadInterstitial();
    });
    ad.load();
    interstitial = ad;
  } catch {
    interstitial = null;
  }
}

function preloadRewarded(): void {
  const native = loadAdsNative();
  if (!native || status !== 'ready' || rewarded) return;

  try {
    const ad = native.RewardedInterstitialAd.createForAdRequest(
      rewardedInterstitialUnitId(),
      { requestNonPersonalizedAdsOnly: !personalizedAds },
    );
    ad.addAdEventListener(native.AdEventType.ERROR, () => {
      rewarded = null;
    });
    ad.addAdEventListener(native.AdEventType.CLOSED, () => {
      rewarded = null;
      preloadRewarded();
    });
    ad.load();
    rewarded = ad;
  } catch {
    rewarded = null;
  }
}

/** Count a finished game. Drives the interstitial cadence. */
export function noteSessionEnded(): void {
  policy = recordSession(policy);
}

/** True when a rewarded ad is loaded right now and could be offered. */
export function rewardReady(): boolean {
  return status === 'ready' && Boolean(rewarded?.loaded);
}

/**
 * Which ad, if either, belongs at this game over. Call once per session end,
 * after noteSessionEnded(). The rules live in policy.ts so they can be tested
 * without an SDK.
 */
export function decideAdMoment(alreadyRevived: boolean): AdMoment {
  if (status !== 'ready') return 'none';
  return chooseAdMoment(
    { policy, rewardLoaded: rewardReady(), alreadyRevived },
    Date.now(),
  );
}

/**
 * Present the interstitial. The decision was already made by decideAdMoment;
 * this only reports whether an ad actually made it to the screen.
 */
export async function showInterstitial(): Promise<boolean> {
  if (status !== 'ready' || !interstitial?.loaded) return false;

  try {
    await interstitial.show();
    policy = recordShown(policy, Date.now());
    return true;
  } catch {
    return false;
  }
}

/**
 * Offer the rewarded interstitial. Resolves true only when the SDK confirms the
 * reward was earned — closing early must not pay out.
 *
 * The subtlety that matters: `show()` resolves when the ad is *presented*, not
 * when it is finished with. Awaiting it and then reading the reward flag always
 * reads it before the reward can possibly have been granted, so the player
 * watches the whole ad and gets nothing. The completion signal is CLOSED, and
 * EARNED_REWARD is what must have fired before it.
 */
export async function showRewardedInterstitial(): Promise<boolean> {
  const native = loadAdsNative();
  const ad = rewarded;
  if (!native || status !== 'ready' || !ad?.loaded) return false;

  return new Promise<boolean>((resolve) => {
    let earned = false;
    let settled = false;
    const unsubscribes: (() => void)[] = [];

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      for (const off of unsubscribes) off();
      resolve(value);
    };

    unsubscribes.push(
      ad.addAdEventListener(native.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(native.AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(native.AdEventType.ERROR, () => finish(false)),
    );

    ad.show().catch(() => finish(false));
  });
}

/** Test seam. */
export function resetAdsForTest(): void {
  status = 'idle';
  policy = newPolicyState();
  personalizedAds = false;
  canShowPrivacyOptions = false;
  interstitial = null;
  rewarded = null;
}
