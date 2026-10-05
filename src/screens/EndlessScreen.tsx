/**
 * EndlessScreen.tsx — the original game, with a way back to the map.
 *
 * Endless keeps its clock, so there is no pause here; leaving is the pause.
 * The way out stays on screen through the game over too, which is why the
 * session-end screen does not need one of its own.
 */

import React, { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import Game from '../game/Game';
import { palette, shell } from '../game/theme';
import { useCopy } from '../i18n/useCopy';
import { INSET_TOP } from './insets';

export default function EndlessScreen({ onExit }: { onExit: () => void }) {
  const copy = useCopy();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [onExit]);

  return (
    <View style={styles.root}>
      <Game mode="endless" />
      <Pressable
        onPress={onExit}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={copy.hud.back}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.55 }]}
      >
        <View style={styles.chevron} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  back: {
    position: 'absolute',
    top: INSET_TOP,
    left: shell.margin,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: shell.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 9,
    height: 9,
    marginLeft: 3,
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: palette.textDim,
    transform: [{ rotate: '-45deg' }],
  },
});
