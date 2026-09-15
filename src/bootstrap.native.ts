/**
 * bootstrap.native.ts — the iOS and Android entry.
 *
 * Skia is linked natively here, so the app mounts immediately. The web build
 * has a different job and lives in bootstrap.web.ts; Metro picks between them
 * by filename, which is the point: a `Platform.OS` branch would still have
 * pulled CanvasKit's browser glue into this bundle, because Metro follows every
 * require it can see regardless of which branch can actually run.
 */

import { registerRootComponent } from 'expo';

import App from './App';
import { initLanguageFromDevice } from './i18n/device';
import { initAds } from './ads';
import { initSound } from './game/sound';

// Language first and synchronously: the first frame should already be in the
// right language rather than flashing English.
initLanguageFromDevice();

// Neither of these is awaited. Ads are never on the critical path to a playable
// ring, and in Expo Go they resolve to "unavailable" and stay there; the tones
// only need to exist by the time somebody first merges, which is seconds away.
void initAds();
void initSound();

registerRootComponent(App);
