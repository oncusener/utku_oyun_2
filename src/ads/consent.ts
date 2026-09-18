/**
 * consent.ts — the ad consent flow, in Halo's idiom.
 *
 * Google's order, matched to what orbeat and zenly do: first UMP (the GDPR/EEA
 * consent form), then iOS App Tracking Transparency. Personalisation is turned
 * on only when *both* say yes; otherwise ads still serve, just non-personalised.
 *
 * Everything here is safe to call when there is no AdMob — the caller only
 * reaches it once `loadAdsNative()` has resolved a real module, so in Expo Go
 * and on web this file is never entered. `expo-tracking-transparency` is still
 * required lazily and wrapped, the same way `native.ts` treats the ads SDK: a
 * static import would run at bundle-evaluation time, before any try/catch of
 * ours could contain a module whose native half is absent.
 *
 * No store and no React binding, unlike zenly's zustand version: Halo shows no
 * banner, so nothing renders off consent state. `initAds()` awaits this before
 * it initialises or preloads, so by the time any ad can be requested the answer
 * is already in hand — the gate is the await, not a flag the UI reads.
 */

import { AppState, Platform } from 'react-native';

import { loadAdsNative } from './native.ts';
import type { AdsNative } from './native.ts';

export type ConsentResult = {
  /** May we request personalised ads? Only when UMP and ATT both allow it. */
  personalizedAds: boolean;
  /** Should a "privacy options" entry point be offered (EEA users)? */
  canShowPrivacyOptions: boolean;
};

/** Lazy, wrapped require of expo-tracking-transparency — see file header. */
type Att = typeof import('expo-tracking-transparency');
let attCached: Att | null | undefined;

function loadAtt(): Att | null {
  if (attCached !== undefined) return attCached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    attCached = require('expo-tracking-transparency') as Att;
  } catch {
    attCached = null;
  }
  return attCached;
}

/** iOS won't present the ATT prompt unless the app is foreground-active; asking
 *  while backgrounded is silently treated as a denial. Wait for `active`. */
function waitUntilActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
}

/**
 * Run the consent flow and report whether personalisation is permitted. Never
 * throws: a failure at any step falls back to non-personalised ads, which is
 * the conservative default the rest of the ads layer already assumes.
 *
 * The two steps sit in separate try blocks on purpose — a UMP failure (for
 * instance, no consent form configured in AdMob) must not stop iOS from asking
 * for ATT.
 */
export async function resolveConsent(native: AdsNative): Promise<ConsentResult> {
  // 1) UMP — shows the consent form when the SDK decides it is required.
  let umpOk = false;
  let canShowPrivacyOptions = false;
  try {
    const info = await native.AdsConsent.gatherConsent();
    umpOk =
      info.status === native.AdsConsentStatus.OBTAINED ||
      info.status === native.AdsConsentStatus.NOT_REQUIRED;
    canShowPrivacyOptions =
      info.privacyOptionsRequirementStatus ===
      native.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    umpOk = false;
  }

  // 2) iOS ATT — without the IDFA there is no personalisation to grant anyway.
  let attOk = true;
  try {
    const att = loadAtt();
    if (Platform.OS === 'ios' && att?.isAvailable()) {
      await waitUntilActive();
      const { granted } = await att.requestTrackingPermissionsAsync();
      attOk = granted;
    }
  } catch {
    attOk = false;
  }

  return { personalizedAds: umpOk && attOk, canShowPrivacyOptions };
}

/**
 * The EEA "manage my privacy choices" form. Wire it to a settings entry when
 * `canShowPrivacyOptions` is true; a no-op everywhere else.
 */
export async function showPrivacyOptions(): Promise<void> {
  const native = loadAdsNative();
  if (!native) return;
  try {
    await native.AdsConsent.showPrivacyOptionsForm();
  } catch {
    // Nothing to surface: a failed privacy form must not crash the game.
  }
}
