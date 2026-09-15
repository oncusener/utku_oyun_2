/**
 * native.ts — resolve the AdMob module, or decide it isn't there.
 *
 * `react-native-google-mobile-ads` has a JS half and a native half. Expo Go
 * ships neither the native half nor a way to add it, so in Expo Go the JS
 * module resolves fine and then throws the moment anything reaches for the
 * native side. That is the single most important fact about this file: the
 * game has to stay playable in Expo Go, which is where it is developed and
 * tested, so every entry point here is allowed to answer "no ads" and nothing
 * downstream may treat that as an error.
 *
 * The require is deliberately lazy and wrapped. Static `import` would run at
 * bundle-evaluation time, before any try/catch of ours could contain it.
 */

import { Platform } from 'react-native';

export type AdsNative = typeof import('react-native-google-mobile-ads');

let cached: AdsNative | null | undefined;

export function loadAdsNative(): AdsNative | null {
  if (cached !== undefined) return cached;

  if (Platform.OS === 'web') {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-google-mobile-ads') as AdsNative;
    cached = typeof mod?.default === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Test seam: forget what we resolved, so a unit test can swap the answer. */
export function resetAdsNativeCache(): void {
  cached = undefined;
}
