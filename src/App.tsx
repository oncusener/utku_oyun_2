/**
 * App.tsx — one screen, no navigator.
 *
 * There is nowhere else to go. Closing the app mid-session loses a score that
 * was never being kept, which is the point.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import Game from './game/Game';
import { palette } from './game/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <Game />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
});
