import type { ExpoConfig } from 'expo/config';

/**
 * app.config.ts — Expo config, driven by the environment.
 *
 * The AdMob ids default to Google's official sample units. That default is the
 * safety property: a checkout with no .env serves test ads, so nobody can
 * accidentally point a debug build at a live account and rack up invalid
 * traffic. Real ids arrive through the environment at build time.
 *
 * `androidAppId` / `iosAppId` are mandatory whenever the AdMob native module is
 * linked — the Google SDK crashes on launch without them — which is why they
 * fall back to the sample app ids rather than to undefined.
 */

const TEST_APP_ID_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511';

const env = (key: string, fallback: string): string => process.env[key] || fallback;

const config: ExpoConfig = {
  name: 'Halka',
  slug: 'halka',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0E13',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#0B0E13',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.halka.ring',
  },
  android: {
    package: 'com.halka.ring',
    adaptiveIcon: { backgroundColor: '#0B0E13' },
    // Explicit rather than defaulted: from targetSdk 36 edge-to-edge can no
    // longer be turned off, and the game already draws full-bleed behind a
    // hidden status bar, so opting in now avoids a layout surprise later.
    edgeToEdgeEnabled: true,
  },
  web: { bundler: 'metro' },
  plugins: [
    'expo-localization',
    [
      'react-native-google-mobile-ads',
      {
        // These must be passed as plugin *props*. The plugin reads nothing
        // else — there is no fallback to a top-level config key — and an
        // undefined androidAppId means the Google SDK crashes the app on
        // launch, so getting this wrong fails at runtime rather than at build.
        androidAppId: env('ADMOB_APP_ID_ANDROID', TEST_APP_ID_ANDROID),
        iosAppId: env('ADMOB_APP_ID_IOS', TEST_APP_ID_IOS),
        delayAppMeasurementInit: true,
        // iOS 14+ attributes installs through SKAdNetwork, and a network whose
        // identifier is absent from Info.plist simply cannot be credited. Only
        // Google's own identifier is listed here because it is the only one
        // that can be stated from knowledge; the ~100 partner identifiers
        // change over time and must be copied from Google's published list
        // before an iOS release, not guessed:
        // https://developers.google.com/admob/ios/quick-start#skadnetwork
        // Missing entries cost attribution, never correctness — the app runs
        // and serves ads either way, which is exactly why this is easy to ship
        // without noticing.
        skAdNetworkItems: ['cstr6suwn9.skadnetwork'],
      },
    ],
  ],

  // Consumed by the AdMob config plugin at prebuild time.
  extra: {
    admob: {
      interstitialAndroid: process.env.ADMOB_INTERSTITIAL_ANDROID,
      interstitialIos: process.env.ADMOB_INTERSTITIAL_IOS,
      rewardedInterstitialAndroid: process.env.ADMOB_REWARDED_ANDROID,
      rewardedInterstitialIos: process.env.ADMOB_REWARDED_IOS,
    },
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
