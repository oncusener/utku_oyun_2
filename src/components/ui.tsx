/**
 * ui.tsx — the handful of pieces every screen around the ring is built from.
 *
 * Taken from the Stitch design system ("Calibrated Precision") and kept to what
 * it actually specifies: hairline borders instead of shadows, one filled button
 * per screen at most, labels in spaced monospace capitals, numbers in a light
 * grotesque. No gradients, no glow, no icons from a font — the few marks the
 * game needs (a coin, a star) are drawn from the same geometry as the ring.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { palette, pieceColors, shell, text } from '../game/theme';

const TEAL = pieceColors[0];
const AMBER = pieceColors[1];

export function Label({
  children,
  color = palette.textDim,
  small = false,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  small?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[small ? text.labelSm : text.label, { color }, style]}>{children}</Text>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** A second line in small capitals under the label. */
  sub?: string;
  /** A small boxed tag at the right edge, e.g. "AD" on a rewarded offer. */
  tag?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The one filled button a screen is allowed. */
export function PrimaryButton({ label, onPress, sub, tag, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.button,
        styles.primary,
        tag ? styles.withTag : null,
        (pressed || disabled) && styles.pressed,
        style,
      ]}
    >
      <View style={styles.buttonBody}>
        <Text style={[styles.buttonLabel, styles.primaryLabel]}>{label}</Text>
        {sub ? <Text style={[styles.buttonSub, styles.primarySub]}>{sub}</Text> : null}
      </View>
      {tag ? (
        <View style={[styles.tag, styles.primaryTag]}>
          <Text style={[text.labelSm, styles.primaryLabel]}>{tag}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Transparent, hairline-bordered: every secondary action. */
export function PillButton({ label, onPress, sub, tag, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.button,
        styles.pill,
        tag ? styles.withTag : null,
        (pressed || disabled) && styles.pressed,
        style,
      ]}
    >
      <View style={styles.buttonBody}>
        <Text style={[styles.buttonLabel, styles.pillLabel]}>{label}</Text>
        {sub ? <Text style={[styles.buttonSub, styles.pillSub]}>{sub}</Text> : null}
      </View>
      {tag ? (
        <View style={[styles.tag, styles.pillTag]}>
          <Text style={[text.labelSm, { color: AMBER }]}>{tag}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The quietest action on a screen: usually "back to the map". */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={[text.label, { color: palette.textDim }]}>{label}</Text>
    </Pressable>
  );
}

export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** A thin track with a teal fill. `value` is clamped to 0..1. */
export function ProgressBar({
  value,
  color = TEAL,
  style,
}: {
  value: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${v * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** A coin is a small halka: an amber ring around a dot. */
export function CoinMark({ size = 16 }: { size?: number }) {
  const dot = Math.max(3, Math.round(size * 0.28));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: AMBER,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: AMBER }}
      />
    </View>
  );
}

/**
 * Stars are drawn as diamonds, the same shape as a prism facet, rather than as
 * a five-pointed glyph: neither font carries one that sits on the baseline the
 * same way on both platforms, and a diamond belongs to this game's geometry.
 */
export function StarPips({
  earned,
  size = 8,
  gap = 5,
  color = AMBER,
  emptyColor = shell.line,
}: {
  earned: number;
  size?: number;
  gap?: number;
  color?: string;
  emptyColor?: string;
}) {
  return (
    <View style={[styles.pips, { gap }]}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            transform: [{ rotate: '45deg' }],
            backgroundColor: i < earned ? color : 'transparent',
            borderWidth: i < earned ? 0 : 1,
            borderColor: emptyColor,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: shell.pill,
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBody: { alignItems: 'center', flexShrink: 1 },
  buttonLabel: { ...text.label, fontSize: 13, letterSpacing: 2.2 },
  buttonSub: { ...text.labelSm, marginTop: 4, letterSpacing: 1.2 },
  primary: { backgroundColor: TEAL, minHeight: 64 },
  primaryLabel: { color: palette.bg },
  primarySub: { color: 'rgba(11,14,19,0.62)' },
  primaryTag: { borderColor: 'rgba(11,14,19,0.35)' },
  pill: { borderWidth: 1, borderColor: shell.line },
  pillLabel: { color: palette.text },
  pillSub: { color: palette.textDim },
  pillTag: { borderColor: 'rgba(246,173,85,0.45)' },
  /** Room for the tag on both sides, so the label stays centred. */
  withTag: { paddingHorizontal: 84 },
  tag: {
    position: 'absolute',
    right: 18,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pressed: { opacity: 0.55 },
  link: { paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'center' },
  panel: {
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.line,
    borderRadius: shell.radius,
  },
  track: {
    height: 2,
    backgroundColor: shell.line,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: { height: 2 },
  pips: { flexDirection: 'row', alignItems: 'center' },
});
