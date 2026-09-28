/**
 * LevelMap.tsx — where you are, and the one button that matters.
 *
 * From the Stitch level map: a path of numbered nodes, twelve to a region,
 * cleared nodes filled in teal with their stars beneath, the next level ringed
 * in amber, the rest dim. The big button at the bottom always plays the next
 * level, so the map is something to look at rather than something to operate —
 * the brief's point about a single tap between opening the app and playing.
 *
 * Left out from the mock-up: invented region lore ("OPTİK REZONANS HATTI"),
 * version strings, the shop and the settings screen. The shop needs store
 * products that do not exist yet; the only setting the game has is the
 * language, and that is a toggle here.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

import {
  CoinMark,
  Label,
  Panel,
  PillButton,
  PrimaryButton,
  ProgressBar,
  StarPips,
} from '../components/ui';
import { REGION_SIZE, levelSpec } from '../game/levels';
import type { LevelSpec } from '../game/levels';
import { palette, pieceColors, shell, text } from '../game/theme';
import { format, toggleLanguage } from '../i18n';
import { useCopy } from '../i18n/useCopy';
import type { Save } from '../progress/save';
import { INSET_BOTTOM, INSET_TOP } from './insets';
import { ObjectiveMark, objectiveLabel } from './objectives';

const TEAL = pieceColors[0];
const AMBER = pieceColors[1];

const ROW = 104;
const NODE = 54;
const NODE_CURRENT = 64;
const PAD_TOP = 36;
/** Where each node sits across the screen, repeating: a slow zig-zag. */
const LANES = [0.5, 0.7, 0.5, 0.3];

type Props = {
  save: Save;
  onPlay: (id: number) => void;
  onEndless: () => void;
};

function regionOf(id: number): number {
  return Math.floor((id - 1) / REGION_SIZE) + 1;
}

export default function LevelMap({ save, onPlay, onEndless }: Props) {
  const copy = useCopy();
  const { width } = useWindowDimensions();

  const next = save.unlocked;
  const highestRegion = regionOf(next) + 1; // one locked region, as a promise
  const [region, setRegion] = useState(regionOf(next));
  const regionLocked = region > regionOf(next);

  const specs = useMemo(
    () =>
      Array.from({ length: REGION_SIZE }, (_, k) =>
        levelSpec((region - 1) * REGION_SIZE + k + 1),
      ),
    [region],
  );

  const points = useMemo(
    () =>
      specs.map((_, k) => ({
        x: width * LANES[k % LANES.length],
        y: PAD_TOP + NODE_CURRENT / 2 + k * ROW,
      })),
    [specs, width],
  );
  const contentHeight = PAD_TOP * 2 + NODE_CURRENT + (REGION_SIZE - 1) * ROW;

  const { donePath, restPath } = useMemo(() => {
    const done = Skia.Path.Make();
    const rest = Skia.Path.Make();
    points.forEach((p, k) => {
      if (k === 0) return;
      const prev = points[k - 1];
      const target = specs[k].id <= next ? done : rest;
      target.moveTo(prev.x, prev.y);
      target.lineTo(p.x, p.y);
    });
    return { donePath: done, restPath: rest };
  }, [points, specs, next]);

  const regionStars = specs.reduce((sum, s) => sum + (save.stars[s.id] ?? 0), 0);
  const regionCleared = specs.filter((s) => save.stars[s.id] !== undefined).length;

  // Open on the next level, not at the top of the region.
  const scroll = useRef<ScrollView>(null);
  const onViewport = useCallback(
    (e: LayoutChangeEvent) => {
      const k = specs.findIndex((s) => s.id === next);
      if (k < 0) return;
      const y = points[k].y - e.nativeEvent.layout.height / 2;
      scroll.current?.scrollTo({ y: Math.max(0, y), animated: false });
    },
    [specs, points, next],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.pager}>
          <Arrow
            dir="left"
            label={copy.map.previousRegion}
            disabled={region <= 1}
            onPress={() => setRegion((r) => Math.max(1, r - 1))}
          />
          <Label color={palette.text} style={styles.regionLabel}>
            {format(copy.map.region, { n: pad(region) })}
          </Label>
          <Arrow
            dir="right"
            label={copy.map.nextRegion}
            disabled={region >= highestRegion}
            onPress={() => setRegion((r) => Math.min(highestRegion, r + 1))}
          />
        </View>
        <View style={styles.summary}>
          {/* One diamond as a unit mark, not three: three would read as a rating. */}
          <View style={styles.starMark} />
          <Text style={styles.summaryValue}>{`${regionStars} / ${REGION_SIZE * 3}`}</Text>
        </View>
        <ProgressBar value={regionCleared / REGION_SIZE} style={styles.regionBar} />
        {regionLocked ? (
          <Label small style={styles.lockNote}>
            {format(copy.map.locked, { n: region - 1 })}
          </Label>
        ) : null}
      </View>

      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={{ height: contentHeight }}
        onLayout={onViewport}
        showsVerticalScrollIndicator={false}
      >
        <Canvas
          style={[StyleSheet.absoluteFill, { height: contentHeight }]}
          pointerEvents="none"
        >
          <Path path={restPath} color={shell.line} style="stroke" strokeWidth={1.5} />
          <Path path={donePath} color={TEAL} style="stroke" strokeWidth={1.5} />
        </Canvas>

        {specs.map((spec, k) => (
          <Node
            key={spec.id}
            spec={spec}
            x={points[k].x}
            y={points[k].y}
            width={width}
            earned={save.stars[spec.id]}
            state={
              spec.id < next || save.stars[spec.id] !== undefined
                ? 'cleared'
                : spec.id === next
                  ? 'current'
                  : 'locked'
            }
            onPress={() => onPlay(spec.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <PrimaryButton
          label={copy.map.play}
          sub={format(copy.map.level, { n: next })}
          onPress={() => onPlay(next)}
        />
        <View style={styles.bottomRow}>
          <Panel style={styles.coins}>
            <CoinMark size={18} />
            <View>
              <Text style={styles.coinsValue}>{save.coins.toLocaleString()}</Text>
              <Label small>{copy.map.coins}</Label>
            </View>
          </Panel>
          <PillButton label={copy.map.endless} onPress={onEndless} style={styles.endless} />
          <PillButton
            label={copy.language.switchTo}
            onPress={toggleLanguage}
            style={styles.language}
          />
        </View>
      </View>
    </View>
  );
}

type NodeState = 'cleared' | 'current' | 'locked';

function Node({
  spec,
  x,
  y,
  width,
  earned,
  state,
  onPress,
}: {
  spec: LevelSpec;
  x: number;
  y: number;
  width: number;
  earned: number | undefined;
  state: NodeState;
  onPress: () => void;
}) {
  const copy = useCopy();
  const size = state === 'current' ? NODE_CURRENT : NODE;
  // Notes go on whichever side has more room.
  const noteOnRight = x <= width / 2;
  const noteWidth = noteOnRight ? width - x - size / 2 - 32 : x - size / 2 - 32;

  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={state === 'locked'}
        accessibilityRole="button"
        accessibilityLabel={format(copy.map.level, { n: spec.id })}
        accessibilityState={{ disabled: state === 'locked' }}
        style={({ pressed }) => [
          styles.node,
          {
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
          },
          state === 'cleared' && styles.nodeCleared,
          state === 'current' && styles.nodeCurrent,
          state === 'locked' && styles.nodeLocked,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text
          style={[
            styles.nodeNumber,
            state === 'cleared' && { color: palette.bg },
            state === 'current' && { color: AMBER, fontSize: 24 },
            state === 'locked' && { color: palette.textDim },
          ]}
        >
          {spec.id}
        </Text>
        {spec.hard ? <View style={styles.hardMark} /> : null}
      </Pressable>

      {state === 'cleared' ? (
        <View
          style={[styles.pips, { left: x - 30, top: y + size / 2 + 8 }]}
          pointerEvents="none"
        >
          <StarPips earned={earned ?? 0} size={6} gap={6} />
        </View>
      ) : null}

      {state === 'current' || (spec.hard && state === 'locked') ? (
        <View
          pointerEvents="none"
          style={[
            styles.note,
            { top: y - 26, width: Math.max(96, noteWidth) },
            noteOnRight
              ? { left: x + size / 2 + 16 }
              : {
                  left: x - size / 2 - 16 - Math.max(96, noteWidth),
                  alignItems: 'flex-end',
                },
          ]}
        >
          {state === 'current' ? (
            <>
              <View style={styles.noteTitle}>
                <View style={styles.noteDot} />
                <Label color={AMBER}>{copy.map.nextUp}</Label>
                {spec.hard ? <Label color={AMBER}>{`· ${copy.map.hard}`}</Label> : null}
              </View>
              {spec.objectives.map((o, i) => (
                <View key={i} style={styles.noteLine}>
                  <ObjectiveMark o={o} size={8} />
                  <Label
                    color={palette.text}
                    small
                  >{`${objectiveLabel(o, copy)} ${o.count}`}</Label>
                </View>
              ))}
            </>
          ) : (
            <Label small color={palette.textDim} style={styles.hardNote}>
              {copy.map.hard}
            </Label>
          )}
        </View>
      ) : null}
    </>
  );
}

function Arrow({
  dir,
  label,
  disabled,
  onPress,
}: {
  dir: 'left' | 'right';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.arrow,
        (pressed || disabled) && { opacity: disabled ? 0.25 : 0.55 },
      ]}
    >
      <View
        style={[
          styles.chevron,
          dir === 'left'
            ? { transform: [{ rotate: '-45deg' }], marginLeft: 4 }
            : { transform: [{ rotate: '135deg' }], marginRight: 4 },
        ]}
      />
    </Pressable>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingTop: INSET_TOP,
    paddingHorizontal: shell.margin,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: shell.line,
  },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  regionLabel: { fontSize: 13, letterSpacing: 3 },
  arrow: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: palette.text,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  summaryValue: { ...text.headline, color: palette.text, fontVariant: ['tabular-nums'] },
  starMark: {
    width: 8,
    height: 8,
    backgroundColor: AMBER,
    transform: [{ rotate: '45deg' }],
  },
  regionBar: { marginTop: 12 },
  scroll: { flex: 1 },
  node: {
    position: 'absolute',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCleared: { backgroundColor: TEAL },
  nodeCurrent: { borderWidth: 1.5, borderColor: AMBER, backgroundColor: palette.bg },
  nodeLocked: { borderWidth: 1, borderColor: shell.line, backgroundColor: palette.bg },
  nodeNumber: { ...text.number, fontSize: 20, color: palette.text },
  hardMark: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 8,
    height: 8,
    backgroundColor: AMBER,
  },
  pips: { position: 'absolute', width: 60, alignItems: 'center' },
  note: { position: 'absolute', gap: 6 },
  noteTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AMBER },
  noteLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hardNote: { marginTop: 20 },
  lockNote: { alignSelf: 'center', marginTop: 12 },
  bottom: {
    paddingHorizontal: shell.margin,
    paddingTop: 14,
    paddingBottom: INSET_BOTTOM + 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: shell.line,
    backgroundColor: palette.bg,
  },
  bottomRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  coins: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coinsValue: {
    ...text.number,
    fontSize: 20,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  endless: { flex: 1, paddingHorizontal: 12 },
  language: { width: 64, paddingHorizontal: 0 },
});
