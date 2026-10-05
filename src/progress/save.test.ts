/**
 * save.test.ts — the rules for what a save means.
 *
 * The file on disk can be anything by the time it is read back. These tests are
 * mostly about that: nothing that comes off disk may stop the game opening or
 * leave the player with an impossible balance.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { levelSpec } from '../game/levels.ts';
import {
  CONTINUE_COST,
  addCoins,
  newSave,
  parseSave,
  recordWin,
  spendCoins,
  totalStars,
} from './save.ts';

test('a new save starts at level one with nothing', () => {
  const s = newSave();
  assert.equal(s.unlocked, 1);
  assert.equal(s.coins, 0);
  assert.deepEqual(s.stars, {});
  assert.equal(totalStars(s), 0);
});

test('winning a level unlocks the next and pays the full reward once', () => {
  const spec = levelSpec(1);
  const first = recordWin(newSave(), spec, 2);
  assert.equal(first.firstClear, true);
  assert.equal(first.paid, spec.reward);
  assert.equal(first.save.unlocked, 2);
  assert.equal(first.save.stars[1], 2);
  assert.equal(first.save.coins, spec.reward);
});

test('replaying a level is not a coin farm', () => {
  const spec = levelSpec(1);
  let save = recordWin(newSave(), spec, 3).save;
  const coinsAfterFirst = save.coins;
  for (let i = 0; i < 50; i++) save = recordWin(save, spec, 3).save;
  assert.equal(save.coins, coinsAfterFirst, 'replays paid out');
});

test('a replay pays only for the stars it adds', () => {
  const spec = levelSpec(12);
  const once = recordWin(newSave(), spec, 1);
  const better = recordWin(once.save, spec, 3);
  assert.equal(better.improved, true);
  assert.equal(better.paid, Math.round((spec.reward / 3) * 2));
  assert.equal(better.save.stars[12], 3);

  // A worse replay keeps the best result and pays nothing.
  const worse = recordWin(better.save, spec, 1);
  assert.equal(worse.paid, 0);
  assert.equal(worse.save.stars[12], 3);
});

test('winning an old level never locks later ones again', () => {
  let save = newSave();
  for (let id = 1; id <= 10; id++) save = recordWin(save, levelSpec(id), 2).save;
  assert.equal(save.unlocked, 11);
  save = recordWin(save, levelSpec(3), 3).save;
  assert.equal(save.unlocked, 11);
});

test('coins cannot be spent into debt', () => {
  const broke = newSave();
  const attempt = spendCoins(broke, CONTINUE_COST);
  assert.equal(attempt.ok, false);
  assert.equal(attempt.save.coins, 0);

  const rich = addCoins(broke, CONTINUE_COST * 2);
  const paid = spendCoins(rich, CONTINUE_COST);
  assert.equal(paid.ok, true);
  assert.equal(paid.save.coins, CONTINUE_COST);
});

test('addCoins and spendCoins reject nonsense amounts', () => {
  const s = addCoins(newSave(), 100);
  for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(addCoins(s, bad).coins, 100);
    assert.equal(spendCoins(s, bad).ok, false);
  }
});

test('parseSave turns garbage into a fresh save rather than throwing', () => {
  for (const junk of [undefined, null, 42, 'save', [], true]) {
    const s = parseSave(junk);
    assert.equal(s.unlocked, 1);
    assert.equal(s.coins, 0);
  }
});

test('parseSave repairs impossible values instead of trusting them', () => {
  const s = parseSave({
    unlocked: -3,
    coins: -500,
    stars: { 1: 3, 2: 9, abc: 2, 0: 1, 4: 2 },
    language: 'fr',
  });
  assert.equal(s.coins, 0, 'negative balance survived');
  assert.deepEqual(s.stars, { 1: 3, 4: 2 }, 'invalid star entries survived');
  assert.equal(s.language, null);
  // Level 4 was won, so level 5 must be open whatever the file claimed.
  assert.equal(s.unlocked, 5);
});

test('parseSave round-trips a real save', () => {
  let save = newSave();
  for (let id = 1; id <= 5; id++) save = recordWin(save, levelSpec(id), 3).save;
  save = { ...save, language: 'tr' };
  assert.deepEqual(parseSave(JSON.parse(JSON.stringify(save))), save);
});
