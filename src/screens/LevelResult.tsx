/**
 * LevelResult.tsx — the end of a level, either way.
 *
 * Laid out from the Stitch "level complete" and "continue offer" screens, with
 * their decorations taken off: no fake telemetry, no bilingual doubling of every
 * label, and no "+3 moves" — Halka has no move limit, so the honest continue
 * is the one the ring can actually use: it empties, and the progress already
 * made toward the goal is kept.
 *
 * The ring stays visible under a flat scrim. A loss is framed on the pieces
 * that were closest to merging (Game turns the ring to show them before this
 * appears), and "94%" means more when the ring that got you there is still in
 * view.
 *
 * Every ad button is shown only when an ad is already loaded, and at most one
 * ad is offered per result; the rules are in ads/policy.ts.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  CoinMark,
  Label,
  Panel,
  PillButton,
  PrimaryButton,
  ProgressBar,
  TextLink,
} from '../components/ui';
import { completion, objectiveDone } from '../game/levels';
import type { LevelProgress, LevelSpec } from '../game/levels';
import { palette, pieceColors, shell, text } from '../game/theme';
import { CONTINUE_COST } from '../progress/save';
import { format } from '../i18n';
import { useCopy } from '../i18n/useCopy';
import { INSET_BOTTOM, INSET_TOP } from './insets';
import { ObjectiveMark, objectiveLabel } from './objectives';

const TEAL = pieceColors[0];
const AMBER = pieceColors[1];

export type Outcome =
  | {
      kind: 'win';
      progress: LevelProgress;
      stars: 1 | 2 | 3;
      /** Coins this win paid. Zero on a replay that added no star. */
      paid: number;
      /** Earned a star this level had not had before, on a replay. */
      improved: boolean;
      /** A rewarded ad is loaded and it is this result's turn to offer one. */
      offerDouble: boolean;
      doubled: boolean;
    }
  | {
      kind: 'fail';
      progress: LevelProgress;
      offerAdContinue: boolean;
      /** Coins cover a continue and none has been used on this attempt. */
      offerCoinContinue: boolean;
    };

type Props = {
  spec: LevelSpec;
  outcome: Outcome;
  balance: number;
  /** True while an ad is on screen; every button waits. */
  busy: boolean;
  onDouble: () => void;
  onNext: () => void;
  onContinueAd: () => void;
  onContinueCoins: () => void;
  onRetry: () => void;
  onMap: () => void;
};

export default function LevelResult(props: Props) {
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
  }, [fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, style]}>
      {props.outcome.kind === 'win' ? (
        <Win {...props} outcome={props.outcome} />
      ) : (
        <Fail {...props} outcome={props.outcome} />
      )}
    </Animated.View>
  );
}

function Header({
  spec,
  status,
  color,
}: {
  spec: LevelSpec;
  status: string;
  color: string;
}) {
  const copy = useCopy();
  return (
    <View style={styles.header}>
      <Label>
        {`${format(copy.map.region, { n: pad(spec.region) })}  ·  ${format(copy.map.level, { n: spec.id })}`}
      </Label>
      <View style={[styles.chip, { borderColor: color }]}>
        <View style={[styles.chipDot, { backgroundColor: color }]} />
        <Label color={color}>{status}</Label>
      </View>
    </View>
  );
}

/** Three diamonds that land one after another. */
function StarReveal({ earned }: { earned: number }) {
  return (
    <View style={styles.starRow}>
      {[0, 1, 2].map((i) => (
        <Pop key={i} delay={260 + i * 180} on={i < earned} />
      ))}
    </View>
  );
}

function Pop({ delay, on }: { delay: number; on: boolean }) {
  const s = useSharedValue(on ? 0.2 : 1);
  useEffect(() => {
    if (on) s.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 180 }));
  }, [s, delay, on]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }, { rotate: '45deg' }],
    opacity: on ? Math.min(1, s.value * 1.4) : 1,
  }));
  return (
    <Animated.View
      style={[
        styles.bigStar,
        on ? { backgroundColor: AMBER } : { borderWidth: 1.5, borderColor: shell.line },
        style,
      ]}
    />
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Label small>{label}</Label>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Win({
  spec,
  outcome,
  balance,
  busy,
  onDouble,
  onNext,
  onMap,
}: Props & { outcome: Extract<Outcome, { kind: 'win' }> }) {
  const copy = useCopy();
  const p = outcome.progress;
  const paid = outcome.doubled ? outcome.paid * 2 : outcome.paid;

  return (
    <View style={styles.body}>
      <Header spec={spec} status={copy.result.complete} color={TEAL} />

      <View style={styles.hero}>
        <StarReveal earned={outcome.stars} />
        {outcome.improved ? (
          <Label color={AMBER} style={styles.newBest}>
            {copy.result.newBest}
          </Label>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <Panel style={styles.stats}>
          <Stat label={copy.result.drops} value={p.drops} />
          <View style={styles.divider} />
          <Stat label={copy.sessionEnd.merges} value={p.merges} />
          <View style={styles.divider} />
          <Stat label={copy.sessionEnd.chain} value={p.bestChain} />
        </Panel>

        <Panel style={styles.coins}>
          <CoinMark size={28} />
          <View style={styles.coinsText}>
            <Label color={palette.text}>{copy.result.coinsEarned}</Label>
            <Label small style={styles.coinsSub}>
              {paid > 0
                ? format(copy.result.balance, { n: balance.toLocaleString() })
                : copy.result.alreadyCollected}
            </Label>
          </View>
          <Text style={[styles.coinsValue, paid === 0 && styles.coinsZero]}>
            {paid > 0 ? `+${paid}` : '—'}
          </Text>
        </Panel>

        {outcome.offerDouble && !outcome.doubled && outcome.paid > 0 ? (
          <PillButton
            label={`${copy.result.double} (+${outcome.paid})`}
            tag={busy ? undefined : copy.result.ad}
            sub={busy ? copy.result.loading : undefined}
            onPress={onDouble}
            disabled={busy}
          />
        ) : null}

        <PrimaryButton
          label={copy.result.next}
          sub={format(copy.map.level, { n: spec.id + 1 })}
          onPress={onNext}
          disabled={busy}
        />
        <TextLink label={copy.result.map} onPress={onMap} />
      </View>
    </View>
  );
}

function Fail({
  spec,
  outcome,
  busy,
  onContinueAd,
  onContinueCoins,
  onRetry,
  onMap,
}: Props & { outcome: Extract<Outcome, { kind: 'fail' }> }) {
  const copy = useCopy();
  const p = outcome.progress;
  const done = completion(spec, p);
  const percent = Math.floor(done * 100);
  const close = done >= 0.75;
  const anyContinue = outcome.offerAdContinue || outcome.offerCoinContinue;

  // Waiting on a rewarded ad: keep the choice on screen but inert.
  const [pressed, setPressed] = useState<'ad' | null>(null);
  useEffect(() => {
    if (!busy) setPressed(null);
  }, [busy]);

  return (
    <View style={styles.body}>
      <Header
        spec={spec}
        status={close ? copy.result.soClose : copy.result.ringFull}
        color={AMBER}
      />

      <View style={styles.hero}>
        <Text style={styles.percent}>{format(copy.result.percent, { n: percent })}</Text>
        <Label style={styles.percentLabel}>{copy.result.goalProgress}</Label>
        <ProgressBar value={done} style={styles.percentBar} />
      </View>

      <View style={styles.bottom}>
        <Panel style={styles.needed}>
          <Label small style={styles.neededTitle}>
            {copy.result.stillNeeded}
          </Label>
          {spec.objectives.map((o, i) => {
            const left = Math.max(0, o.count - objectiveDone(o, p));
            if (left === 0) return null;
            return (
              <View key={i} style={styles.neededRow}>
                <ObjectiveMark o={o} />
                <Label color={palette.text} style={styles.neededLabel}>
                  {objectiveLabel(o, copy)}
                </Label>
                <Text style={styles.neededValue}>{left}</Text>
              </View>
            );
          })}
        </Panel>

        {outcome.offerAdContinue ? (
          <PrimaryButton
            label={copy.result.continue}
            sub={pressed === 'ad' ? copy.result.loading : copy.result.continueHint}
            tag={copy.result.ad}
            onPress={() => {
              setPressed('ad');
              onContinueAd();
            }}
            disabled={busy}
          />
        ) : null}

        {outcome.offerCoinContinue ? (
          <PillButton
            label={format(copy.result.continueCoins, { n: CONTINUE_COST })}
            sub={outcome.offerAdContinue ? undefined : copy.result.continueHint}
            onPress={onContinueCoins}
            disabled={busy}
          />
        ) : null}

        {anyContinue ? (
          <PillButton label={copy.result.retry} onPress={onRetry} disabled={busy} />
        ) : (
          <PrimaryButton label={copy.result.retry} onPress={onRetry} disabled={busy} />
        )}

        <TextLink label={copy.result.map} onPress={onMap} />
      </View>
    </View>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: shell.scrim },
  body: {
    flex: 1,
    paddingTop: INSET_TOP,
    paddingBottom: INSET_BOTTOM,
    paddingHorizontal: shell.margin,
  },
  header: { alignItems: 'center', gap: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  starRow: { flexDirection: 'row', gap: 28, alignItems: 'center' },
  bigStar: { width: 26, height: 26 },
  newBest: { marginTop: 22 },
  bottom: { gap: 12 },
  stats: { flexDirection: 'row', paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { ...text.number, color: palette.text, fontVariant: ['tabular-nums'] },
  divider: { width: 1, backgroundColor: shell.line },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  coinsText: { flex: 1, gap: 4 },
  coinsSub: { letterSpacing: 1.2 },
  coinsValue: { ...text.number, color: AMBER, fontVariant: ['tabular-nums'] },
  coinsZero: { color: palette.textDim },
  percent: {
    ...text.displayXL,
    fontSize: 88,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  percentLabel: { marginTop: 4 },
  percentBar: { width: '72%', marginTop: 18 },
  needed: { paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  neededTitle: { marginBottom: 2 },
  neededRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  neededLabel: { flex: 1 },
  neededValue: { ...text.number, fontSize: 22, color: palette.text },
});
