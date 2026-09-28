/**
 * LevelHud.tsx — what a level asks for, laid over the ring.
 *
 * The Stitch mock-up for this screen had eleven readouts: coins, score, best,
 * streak, azimuth, a rotate slider, a hint button, a mute button... The ring is
 * the interface, and every one of those either repeats what the ring already
 * shows or is a control the thumb does not need. What survives is what the
 * player cannot see on the ring itself: which level this is, what it wants, how
 * far along they are, and whether three stars are still on the table.
 *
 * Touches fall through to the ring everywhere except the pause button.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Label, ProgressBar, StarPips } from '../components/ui';
import { completion, objectiveDone, stars } from '../game/levels';
import type { LevelProgress, LevelSpec, Lesson } from '../game/levels';
import { palette, pieceColors, shell, text } from '../game/theme';
import { format } from '../i18n';
import { useCopy } from '../i18n/useCopy';
import { INSET_BOTTOM, INSET_TOP } from './insets';
import { ObjectiveMark, objectiveLabel } from './objectives';

type Props = {
  spec: LevelSpec;
  progress: LevelProgress;
  lesson: Lesson | undefined;
  onPause: () => void;
};

export default function LevelHud({ spec, progress, lesson, onPause }: Props) {
  const copy = useCopy();
  // What the level would pay if it were won on this drop: a live read of par,
  // without putting a move counter on screen that looks like a limit.
  const onTrack = stars(spec, progress);
  // A lesson stays up until the idea it teaches has worked once.
  const lessonDone = spec.objectives.some((o) => objectiveDone(o, progress) > 0);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.side} pointerEvents="box-none">
          <Pressable
            onPress={onPause}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={copy.hud.pause}
            style={({ pressed }) => [styles.pause, pressed && styles.pressed]}
          >
            <View style={styles.bar} />
            <View style={styles.bar} />
          </Pressable>
        </View>

        <View style={styles.title} pointerEvents="none">
          <View style={styles.titleRow}>
            <Label color={palette.text}>{format(copy.map.level, { n: spec.id })}</Label>
            {spec.hard ? (
              <Label color={pieceColors[1]}>{`· ${copy.map.hard}`}</Label>
            ) : null}
          </View>
          <ProgressBar value={completion(spec, progress)} style={styles.progress} />
        </View>

        <View style={[styles.side, styles.stars]} pointerEvents="none">
          <StarPips earned={onTrack} size={7} gap={6} />
          <Label small style={styles.drops}>
            {`${copy.hud.drops} ${progress.drops}`}
          </Label>
        </View>
      </View>

      <View style={styles.objectives} pointerEvents="none">
        {spec.objectives.map((o, i) => {
          const done = objectiveDone(o, progress);
          const complete = done >= o.count;
          return (
            <View key={i} style={styles.objective}>
              <ObjectiveMark o={o} />
              <Label>{objectiveLabel(o, copy)}</Label>
              <Text style={[styles.count, complete && styles.countDone]}>
                {`${done}/${o.count}`}
              </Text>
            </View>
          );
        })}
      </View>

      {lesson && !lessonDone ? (
        <Text style={styles.lesson} pointerEvents="none">
          {copy.lesson[lesson]}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: INSET_TOP,
    paddingHorizontal: shell.margin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pause: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: shell.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: { width: 2, height: 12, backgroundColor: palette.textDim },
  pressed: { opacity: 0.55 },
  title: { alignItems: 'center', flex: 1, marginHorizontal: 12 },
  titleRow: { flexDirection: 'row', gap: 6 },
  progress: { width: 132, marginTop: 10 },
  /** Both sides the same width, so the title sits on the ring's axis. */
  side: { width: 72 },
  stars: { alignItems: 'flex-end', gap: 8 },
  drops: { letterSpacing: 1.2 },
  objectives: {
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 22,
    paddingHorizontal: shell.margin,
  },
  objective: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: {
    ...text.number,
    fontSize: 22,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  countDone: { color: pieceColors[0] },
  lesson: {
    ...text.body,
    position: 'absolute',
    left: shell.margin,
    right: shell.margin,
    bottom: INSET_BOTTOM + 28,
    textAlign: 'center',
    lineHeight: 20,
    color: palette.textDim,
  },
});
