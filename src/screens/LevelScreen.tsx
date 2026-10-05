/**
 * LevelScreen.tsx — one level: the ring, its HUD, and what happens at the end.
 *
 * Game owns the ring and reports three things upward: progress after every
 * move, a win, a loss. Everything else — stars, coins, the continue offer, the
 * pause sheet, which ad may run — is decided here, so Game never learns that
 * coins or ads exist.
 *
 * An attempt is a Game mount. Retrying bumps `attempt`, which re-keys Game and
 * gives it a fresh ring and a freshly seeded bag; continuing bumps
 * `reviveToken` instead, which empties the ring and keeps the progress.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import Game from '../game/Game';
import { lessonFor, newProgress, stars } from '../game/levels';
import type { LevelProgress, LevelSpec } from '../game/levels';
import { palette, shell } from '../game/theme';
import {
  decideAdMoment,
  noteSessionEnded,
  showInterstitial,
  showRewardedInterstitial,
} from '../ads';
import { CONTINUE_COST, addCoins, recordWin, spendCoins } from '../progress/save';
import type { Save } from '../progress/save';
import { Label, PillButton, PrimaryButton, TextLink } from '../components/ui';
import { useCopy } from '../i18n/useCopy';
import LevelHud from './LevelHud';
import LevelResult from './LevelResult';
import type { Outcome } from './LevelResult';

type Props = {
  spec: LevelSpec;
  balance: number;
  /** Apply a change to the save, persist it, and return the new save. */
  updateSave: (change: (save: Save) => Save) => Save;
  onNext: () => void;
  onMap: () => void;
};

export default function LevelScreen({ spec, balance, updateSave, onNext, onMap }: Props) {
  const copy = useCopy();
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<LevelProgress>(() => newProgress(spec));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [reviveToken, setReviveToken] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);

  /** One continue per attempt, whichever way it was paid for. */
  const continued = useRef(false);
  /** The interstitial the policy asked for, held until the player leaves. */
  const interstitialDue = useRef(false);

  const run = useMemo(() => ({ spec, attempt }), [spec, attempt]);
  const lesson = useMemo(() => lessonFor(spec), [spec]);

  const onProgress = useCallback((p: LevelProgress) => setProgress(p), []);

  const onWin = useCallback(
    (p: LevelProgress) => {
      const earned = stars(spec, p);
      let paid = 0;
      let improved = false;
      updateSave((save) => {
        const win = recordWin(save, spec, earned);
        paid = win.paid;
        improved = win.improved && !win.firstClear;
        return win.save;
      });

      noteSessionEnded();
      // At most one ad per result. On a win the rewarded slot is "double the
      // reward"; an interstitial, if one is due, waits for the way out.
      const moment = decideAdMoment(false);
      interstitialDue.current = moment === 'interstitial';
      setOutcome({
        kind: 'win',
        progress: p,
        stars: earned,
        paid,
        improved,
        offerDouble: moment === 'revive',
        doubled: false,
      });
    },
    [spec, updateSave],
  );

  const onFail = useCallback(
    (p: LevelProgress) => {
      noteSessionEnded();
      const moment = decideAdMoment(continued.current);
      interstitialDue.current = moment === 'interstitial';
      setOutcome({
        kind: 'fail',
        progress: p,
        offerAdContinue: moment === 'revive',
        offerCoinContinue: !continued.current && balance >= CONTINUE_COST,
      });
    },
    [balance],
  );

  /** Run a due interstitial, then go wherever the player asked to. */
  const leave = useCallback(async (then: () => void) => {
    if (interstitialDue.current) {
      interstitialDue.current = false;
      setBusy(true);
      await showInterstitial();
      setBusy(false);
    }
    then();
  }, []);

  const retry = useCallback(() => {
    continued.current = false;
    setPaused(false);
    setOutcome(null);
    setProgress(newProgress(spec));
    // Reset with the remount, or the new Game would continue on arrival.
    setReviveToken(0);
    setAttempt((a) => a + 1);
  }, [spec]);

  const resume = useCallback(() => {
    continued.current = true;
    // Chose to keep playing: do not follow that with an interruption.
    interstitialDue.current = false;
    setOutcome(null);
    setReviveToken((t) => t + 1);
  }, []);

  const continueWithAd = useCallback(async () => {
    setBusy(true);
    const earned = await showRewardedInterstitial();
    setBusy(false);
    // Only a confirmed reward continues; closing the ad early does not.
    if (earned) resume();
  }, [resume]);

  const continueWithCoins = useCallback(() => {
    let ok = false;
    updateSave((save) => {
      const spent = spendCoins(save, CONTINUE_COST);
      ok = spent.ok;
      return spent.save;
    });
    if (ok) resume();
  }, [updateSave, resume]);

  const doubleReward = useCallback(async () => {
    if (outcome?.kind !== 'win' || outcome.doubled || outcome.paid <= 0) return;
    setBusy(true);
    const earned = await showRewardedInterstitial();
    setBusy(false);
    if (!earned) return;
    updateSave((save) => addCoins(save, outcome.paid));
    setOutcome({ ...outcome, doubled: true });
  }, [outcome, updateSave]);

  // Android's back button: pause first, then out.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (outcome) void leave(onMap);
      else setPaused((p) => !p);
      return true;
    });
    return () => sub.remove();
  }, [busy, outcome, leave, onMap]);

  return (
    <View style={styles.root}>
      <Game
        key={attempt}
        mode="level"
        run={run}
        reviveToken={reviveToken}
        paused={paused && !outcome}
        onProgress={onProgress}
        onWin={onWin}
        onFail={onFail}
      />

      {/* The result screen restates the level in its own header; left up, the
          HUD would show through the scrim and print it twice. */}
      {outcome ? null : (
        <LevelHud
          spec={spec}
          progress={progress}
          lesson={lesson}
          onPause={() => setPaused(true)}
        />
      )}

      {paused && !outcome ? (
        <View style={[StyleSheet.absoluteFill, styles.scrim]}>
          <View style={styles.pause}>
            <Label color={palette.text} style={styles.pauseTitle}>
              {copy.pause.title}
            </Label>
            <PrimaryButton label={copy.pause.resume} onPress={() => setPaused(false)} />
            <PillButton label={copy.pause.restart} onPress={retry} />
            <TextLink label={copy.result.map} onPress={onMap} />
          </View>
        </View>
      ) : null}

      {outcome ? (
        <LevelResult
          spec={spec}
          outcome={outcome}
          balance={balance}
          busy={busy}
          onDouble={doubleReward}
          onNext={() => void leave(onNext)}
          onContinueAd={continueWithAd}
          onContinueCoins={continueWithCoins}
          onRetry={() => void leave(retry)}
          onMap={() => void leave(onMap)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  scrim: { backgroundColor: shell.scrim, justifyContent: 'flex-end' },
  pause: { paddingHorizontal: shell.margin, paddingBottom: 48, gap: 12 },
  pauseTitle: { alignSelf: 'center', marginBottom: 28 },
});
