const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// macOS privacy protection blocks watchman from opening anything under
// ~/Downloads, and Metro's dev server hard-fails on that rather than falling
// back the way `expo export` does. Node's own crawler and file watching work
// fine here; the project is small enough that the difference is invisible.
config.resolver.useWatchman = false;

// Web preview only: Skia runs on CanvasKit, which is a .wasm Metro would not
// otherwise serve, and CanvasKit's threaded build needs SharedArrayBuffer,
// which browsers gate behind cross-origin isolation. Neither line affects the
// iOS or Android bundle.
config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(req, res, next);
};

module.exports = config;
