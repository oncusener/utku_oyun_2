module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last. Without it every 'worklet' in Game.tsx silently runs on
    // the JS thread instead, which looks fine at 60fps on a desk and drops
    // frames the moment the phone is doing anything else.
    plugins: ['react-native-reanimated/plugin'],
  };
};
