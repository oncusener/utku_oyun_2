/**
 * App.tsx — three screens, no navigator.
 *
 * The map, a level, and endless. A navigation library would bring a stack,
 * transitions and deep links to a game whose whole route table fits in one
 * union type, so this is a `useState`.
 *
 * App also owns the save. It is read once at startup and written after every
 * change that matters — a win, a spent or earned coin, a language chosen in the
 * app — through `updateSave`, which is the only way anything reaches it.
 *
 * The first launch skips the map and opens level 1: someone who has never
 * played should be one touch from the ring, not from a menu.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';

import { levelSpec } from './game/levels';
import { palette } from './game/theme';
import { getLanguage, setLanguage, subscribe } from './i18n';
import { newSave, totalStars } from './progress/save';
import type { Save } from './progress/save';
import { loadSave, writeSave } from './progress/storage';
import EndlessScreen from './screens/EndlessScreen';
import LevelMap from './screens/LevelMap';
import LevelScreen from './screens/LevelScreen';

type Screen = { name: 'map' } | { name: 'level'; id: number } | { name: 'endless' };

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  const [save, setSave] = useState<Save | null>(null);
  const saveRef = useRef<Save | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'map' });

  useEffect(() => {
    let live = true;
    void loadSave().then((loaded) => {
      if (!live) return;
      // The ref first: restoring the language notifies the listener below,
      // which must find the loaded save rather than write over it.
      saveRef.current = loaded;
      if (loaded.language) setLanguage(loaded.language);
      setSave(loaded);
      if (loaded.unlocked === 1 && totalStars(loaded) === 0) {
        setScreen({ name: 'level', id: 1 });
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const updateSave = useCallback((change: (save: Save) => Save): Save => {
    const current = saveRef.current;
    // Until the save has been read, there is nothing safe to write: a blank
    // save written now would replace the player's real one.
    if (!current) return newSave();
    const next = change(current);
    if (next === current) return current;
    saveRef.current = next;
    setSave(next);
    void writeSave(next);
    return next;
  }, []);

  // A language picked in the app is remembered; the device default is not
  // written down, so a player who never touches the toggle follows their phone.
  useEffect(
    () =>
      subscribe(() => {
        const language = getLanguage();
        updateSave((s) => (s.language === language ? s : { ...s, language }));
      }),
    [updateSave],
  );

  const toMap = useCallback(() => setScreen({ name: 'map' }), []);
  const play = useCallback((id: number) => setScreen({ name: 'level', id }), []);
  const endless = useCallback(() => setScreen({ name: 'endless' }), []);

  const levelId = screen.name === 'level' ? screen.id : null;
  const spec = useMemo(() => (levelId === null ? null : levelSpec(levelId)), [levelId]);
  const next = useCallback(() => {
    if (levelId !== null) setScreen({ name: 'level', id: levelId + 1 });
  }, [levelId]);

  const ready = (fontsLoaded || fontError) && save;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      {!ready ? (
        <View style={styles.root} />
      ) : screen.name === 'map' ? (
        <LevelMap save={save} onPlay={play} onEndless={endless} />
      ) : screen.name === 'endless' ? (
        <EndlessScreen onExit={toMap} />
      ) : spec ? (
        <LevelScreen
          key={spec.id}
          spec={spec}
          balance={save.coins}
          updateSave={updateSave}
          onNext={next}
          onMap={toMap}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
});
