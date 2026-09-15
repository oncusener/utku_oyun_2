/**
 * adUnits.ts — which ad unit to ask for.
 *
 * Google's test units are used in development and whenever a real unit is
 * missing from the app config. That default matters: serving *live* ads to a
 * developer's own emulator is how AdMob accounts get suspended for invalid
 * traffic, so the safe value has to be the one you get by doing nothing.
 *
 * Real ids come from app.config.ts -> extra.admob, which reads them from the
 * environment. They are not secrets — ad unit ids ship inside the APK and can
 * be read out of it — but keeping them in env means a fork does not
 * accidentally serve impressions to this project's account.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { loadAdsNative } from './native.ts';

type AdmobExtra = {
  interstitialAndroid?: string;
  interstitialIos?: string;
  rewardedInterstitialAndroid?: string;
  rewardedInterstitialIos?: string;
};

function extra(): AdmobExtra {
  const value = Constants.expoConfig?.extra?.admob;
  return (value ?? {}) as AdmobExtra;
}

function pick(android: string | undefined, ios: string | undefined): string | null {
  const id = Platform.OS === 'ios' ? ios : android;
  return id && id.startsWith('ca-app-pub-') ? id : null;
}

export function interstitialUnitId(): string {
  const native = loadAdsNative();
  const test = native?.TestIds.INTERSTITIAL ?? '';
  if (__DEV__) return test;
  const e = extra();
  return pick(e.interstitialAndroid, e.interstitialIos) ?? test;
}

export function rewardedInterstitialUnitId(): string {
  const native = loadAdsNative();
  const test = native?.TestIds.REWARDED_INTERSTITIAL ?? '';
  if (__DEV__) return test;
  const e = extra();
  return pick(e.rewardedInterstitialAndroid, e.rewardedInterstitialIos) ?? test;
}

/** True when we are about to request a real, billable impression. */
export function servingLiveAds(): boolean {
  if (__DEV__) return false;
  const e = extra();
  return pick(e.interstitialAndroid, e.interstitialIos) !== null;
}
