/**
 * SessionEnd.tsx — the end of an endless run.
 *
 * Endless is the original Halka, kept as it was: a score attack with a clock.
 * Levels are where progress is kept now (see screens/), so this screen is still
 * trying not to be a scoreboard. There is no high score, no streak, no share
 * button, and nothing from an endless run is stored.
 *
 * It fades in over the same 400ms the board fades out, so the two are one
 * movement rather than two screens.
 *
 * The reward offer appears only when an ad is already loaded, so the row never
 * shows a button that would then have to fail. In Expo Go it never appears at
 * all, which is the intended behaviour rather than a degraded one.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TIMING } from '../game/feedback';
import { fonts, palette, type as typeScale } from '../game/theme';
import { toggleLanguage } from '../i18n';
import { useCopy } from '../i18n/useCopy';

export type SessionStats = {
  score: number;
  level: number;
  merges: number;
  bestChain: number;
};

type Props = {
  stats: SessionStats;
  onRestart: () => void;
  /** Offered only when a rewarded ad is loaded; absent otherwise. */
  onRevive?: () => Promise<void>;
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function SessionEnd({ stats, onRestart, onRevive }: Props) {
  const copy = useCopy();
  const fade = useSharedValue(0);
  const [reviving, setReviving] = useState(false);

  useEffect(() => {
    fade.value = withTiming(1, {
      duration: TIMING.CROSS_FADE_MS,
      easing: Easing.inOut(Easing.quad),
    });
  }, [fade]);

  const style = useAnimatedStyle(() => ({ opacity: fade.value }));

  const handleRevive = useCallback(async () => {
    if (!onRevive || reviving) return;
    setReviving(true);
    try {
      await onRevive();
    } finally {
      setReviving(false);
    }
  }, [onRevive, reviving]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, style]}>
      <Pressable
        style={styles.press}
        onPress={onRestart}
        accessibilityRole="button"
        accessibilityLabel={`${stats.score}. ${copy.sessionEnd.again}`}
      >
        <Text style={styles.score}>{stats.score}</Text>

        <View style={styles.row}>
          <Stat label={copy.sessionEnd.level} value={stats.level} />
          <Stat label={copy.sessionEnd.merges} value={stats.merges} />
          <Stat label={copy.sessionEnd.chain} value={stats.bestChain} />
        </View>

        <Text style={styles.hint}>{copy.sessionEnd.again}</Text>
      </Pressable>

      {onRevive ? (
        <Pressable
          style={styles.revive}
          onPress={handleRevive}
          disabled={reviving}
          accessibilityRole="button"
          accessibilityLabel={copy.sessionEnd.revive}
        >
          <Text style={styles.reviveText}>
            {reviving ? copy.sessionEnd.reviveLoading : copy.sessionEnd.revive}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.language}
        onPress={toggleLanguage}
        accessibilityRole="button"
        accessibilityLabel={copy.language.switchTo}
      >
        <Text style={styles.languageText}>{copy.language.switchTo}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.bg },
  press: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  score: {
    ...typeScale.score,
    fontFamily: fonts.displayLight,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    marginTop: 44,
    gap: 36,
  },
  stat: { alignItems: 'center' },
  statValue: {
    fontFamily: fonts.displayLight,
    fontSize: 22,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typeScale.label,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: palette.textDim,
    marginTop: 6,
  },
  hint: {
    ...typeScale.hint,
    fontFamily: fonts.mono,
    fontSize: 13,
    color: palette.textDim,
    position: 'absolute',
    bottom: 72,
  },
  revive: {
    position: 'absolute',
    bottom: 128,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.slotEmptyRim,
  },
  reviveText: {
    ...typeScale.hint,
    fontFamily: fonts.mono,
    fontSize: 13,
    color: palette.text,
  },
  language: {
    position: 'absolute',
    top: 56,
    right: 28,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  languageText: {
    ...typeScale.label,
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    color: palette.textDim,
  },
});
