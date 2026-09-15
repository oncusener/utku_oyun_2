/**
 * bootstrap.web.ts — the browser preview entry.
 *
 * On web, Skia is CanvasKit: the wasm module has to finish loading before a
 * single Skia node mounts, so App is imported lazily behind it. The wasm is
 * served out of public/ at the web root — Metro has no route of its own for it
 * and would hand back index.html instead. See `npm run web:setup`.
 *
 * No ads here. AdMob has no web implementation, and the web target exists only
 * to preview the game on a machine without a simulator.
 */

import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { initLanguageFromDevice } from './i18n/device';

initLanguageFromDevice();

LoadSkiaWeb({ locateFile: (file: string) => `/${file}` })
  .then(async () => {
    const App = (await import('./App')).default;
    registerRootComponent(App);
  })
  .catch((err: unknown) => {
    console.error('CanvasKit failed to load', err);
  });
