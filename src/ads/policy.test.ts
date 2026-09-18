/**
 * policy.test.ts — the interruption rules.
 *
 * These are the rules that decide whether Halo stays the thing it is meant to
 * be, so they are tested rather than trusted.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COOLDOWN_MS,
  GRACE_SESSIONS,
  chooseAdMoment,
  SESSIONS_PER_INTERSTITIAL,
  newPolicyState,
  recordSession,
  recordShown,
  shouldShowInterstitial,
} from './policy.ts';
import type { PolicyState } from './policy.ts';

const afterSessions = (n: number): PolicyState => {
  let state = newPolicyState();
  for (let i = 0; i < n; i++) state = recordSession(state);
  return state;
};

test('the opening sessions are never interrupted', () => {
  for (let n = 1; n <= GRACE_SESSIONS; n++) {
    assert.equal(
      shouldShowInterstitial(afterSessions(n), 0),
      false,
      `session ${n} is inside the grace period`,
    );
  }
});

test('after the grace period, ads come on the cadence and not before', () => {
  const shown: number[] = [];
  for (let n = GRACE_SESSIONS + 1; n <= 24; n++) {
    if (shouldShowInterstitial(afterSessions(n), 0)) shown.push(n);
  }
  assert.ok(shown.length > 0, 'no ad would ever show');
  for (const n of shown) {
    assert.equal(n % SESSIONS_PER_INTERSTITIAL, 0, `session ${n} is off-cadence`);
  }
  // Consecutive eligible sessions must be a full cadence apart.
  for (let i = 1; i < shown.length; i++) {
    assert.equal(shown[i] - shown[i - 1], SESSIONS_PER_INTERSTITIAL);
  }
});

test('the cooldown outranks the cadence', () => {
  const eligible = afterSessions(SESSIONS_PER_INTERSTITIAL * 4);
  const now = 1_000_000;
  assert.equal(shouldShowInterstitial(eligible, now), true);

  const justShown = recordShown(eligible, now);
  assert.equal(
    shouldShowInterstitial(justShown, now + COOLDOWN_MS - 1),
    false,
    'showed a second ad inside the cooldown',
  );
  assert.equal(shouldShowInterstitial(justShown, now + COOLDOWN_MS), true);
});

test('a burst of quick sessions cannot produce a burst of ads', () => {
  // Someone losing repeatedly in seconds must not be shown ad after ad.
  let state = newPolicyState();
  let clock = 0;
  let ads = 0;

  for (let session = 0; session < 40; session++) {
    state = recordSession(state);
    clock += 4_000; // a very fast, very bad run
    if (shouldShowInterstitial(state, clock)) {
      ads++;
      state = recordShown(state, clock);
    }
  }

  const elapsedMinutes = clock / 60_000;
  assert.ok(
    ads <= Math.ceil(elapsedMinutes / (COOLDOWN_MS / 60_000)) + 1,
    `${ads} ads in ${elapsedMinutes} minutes is too many`,
  );
});

test('recording is pure — no state is mutated in place', () => {
  const state = newPolicyState();
  const advanced = recordSession(state);
  assert.equal(state.sessions, 0);
  assert.equal(advanced.sessions, 1);

  const marked = recordShown(state, 5);
  assert.equal(state.lastShownAt, null);
  assert.equal(marked.lastShownAt, 5);
});

/* ------------------------------------------------------------------ *
 * Choosing between the two paths
 * ------------------------------------------------------------------ */

test('an always-available reward does not switch interstitials off', () => {
  // The regression this file exists for. A rewarded ad is preloaded nearly all
  // the time and every fresh run resets the once-per-run flag, so a rule that
  // gave the revive first refusal meant the interstitial never ran at all.
  let state = newPolicyState();
  let clock = 0;
  let interstitials = 0;
  let revives = 0;

  for (let session = 0; session < 40; session++) {
    state = recordSession(state);
    clock += 90_000;
    const moment = chooseAdMoment(
      { policy: state, rewardLoaded: true, alreadyRevived: false },
      clock,
    );
    if (moment === 'interstitial') {
      interstitials++;
      state = recordShown(state, clock);
    } else if (moment === 'revive') {
      revives++;
    }
  }

  assert.ok(interstitials > 0, 'interstitials never fired with a reward always ready');
  assert.ok(revives > 0, 'the revive never got offered');
});

test('the two paths never fire at the same game over', () => {
  for (let sessions = 1; sessions <= 20; sessions++) {
    for (const rewardLoaded of [true, false]) {
      for (const alreadyRevived of [true, false]) {
        const state = { sessions, lastShownAt: null };
        const moment = chooseAdMoment({ policy: state, rewardLoaded, alreadyRevived }, 0);
        assert.ok(['interstitial', 'revive', 'none'].includes(moment));
      }
    }
  }
});

test('an interstitial that is due outranks the revive', () => {
  const due = afterSessions(SESSIONS_PER_INTERSTITIAL * 3);
  assert.equal(
    chooseAdMoment({ policy: due, rewardLoaded: true, alreadyRevived: false }, 1_000_000),
    'interstitial',
  );
});

test('the revive fills the sessions the interstitial does not take', () => {
  const notDue = afterSessions(SESSIONS_PER_INTERSTITIAL * 3 + 1);
  assert.equal(
    chooseAdMoment({ policy: notDue, rewardLoaded: true, alreadyRevived: false }, 1_000_000),
    'revive',
  );
  // ...but only once per run, and only when one is loaded.
  assert.equal(
    chooseAdMoment({ policy: notDue, rewardLoaded: true, alreadyRevived: true }, 1_000_000),
    'none',
  );
  assert.equal(
    chooseAdMoment({ policy: notDue, rewardLoaded: false, alreadyRevived: false }, 1_000_000),
    'none',
  );
});

test('nothing is offered during the opening grace period', () => {
  for (let n = 1; n <= GRACE_SESSIONS; n++) {
    const moment = chooseAdMoment(
      { policy: afterSessions(n), rewardLoaded: true, alreadyRevived: false },
      0,
    );
    assert.notEqual(moment, 'interstitial', `session ${n} showed an interstitial`);
  }
});
