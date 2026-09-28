/**
 * levels.test.ts — the level catalogue and how a level is scored.
 *
 * The balance itself was tuned by simulation (see the notes in levels.ts);
 * these tests pin down the properties that tuning must never break: every level
 * is well formed and winnable in principle, teaching levels teach, objectives
 * cannot be over-reported, and a level ends in a win or a full ring and nothing
 * else.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SLOTS, anchorIndex, applyDrop, emptyBoard, findMatch, resolve } from './engine.ts';
import type { Board, Piece } from './engine.ts';
import {
  applyMove,
  completion,
  firstLevelWith,
  focusColour,
  lessonFor,
  levelComplete,
  levelFailed,
  levelSpec,
  newProgress,
  objectiveDone,
  REGION_SIZE,
  stars,
  LEVEL_SETTLE_FLOOR_MS,
  LEVEL_SETTLE_START_MS,
  levelSettleMs,
} from './levels.ts';

const c = (n: 0 | 1 | 2): Piece => ({ color: n });

test('levelSpec is a pure function of the level number', () => {
  for (const id of [1, 7, 23, 60, 250]) {
    assert.deepEqual(levelSpec(id), levelSpec(id));
  }
});

test('levelSpec rejects anything that is not a level', () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => levelSpec(bad), RangeError);
  }
});

test('every level for a long way is well formed', () => {
  for (let id = 1; id <= 400; id++) {
    const spec = levelSpec(id);
    assert.ok(spec.objectives.length >= 1, `level ${id} asks for nothing`);
    assert.ok(spec.par >= 3, `level ${id} par ${spec.par} is below one merge`);
    assert.ok(spec.reward > 0, `level ${id} pays nothing`);
    assert.ok(spec.help > 0 && spec.help <= 1, `level ${id} help ${spec.help}`);
    assert.equal(spec.start.length, SLOTS);
    // A starting ring must never already contain a merge, or the level would
    // resolve before the player touches it.
    assert.equal(findMatch(spec.start), null, `level ${id} starts mid-merge`);
    // ...and the anchor slot must be free, or the first drop is impossible.
    assert.equal(spec.start[anchorIndex(0)], null, `level ${id} starts blocked`);
    for (const o of spec.objectives) assert.ok(o.count >= 1);
  }
});

test('regions are contiguous and numbered from one', () => {
  assert.equal(levelSpec(1).region, 1);
  assert.equal(levelSpec(REGION_SIZE).region, 1);
  assert.equal(levelSpec(REGION_SIZE + 1).region, 2);
  assert.equal(levelSpec(REGION_SIZE + 1).slot, 1);
  assert.equal(levelSpec(REGION_SIZE).slot, REGION_SIZE);
});

test('arriving in a new region never starts with a hard level', () => {
  for (let region = 1; region <= 30; region++) {
    const first = (region - 1) * REGION_SIZE + 1;
    assert.equal(levelSpec(first).hard, false, `region ${region} opens hard`);
  }
});

test('the opening levels are near-free and each teaches one thing', () => {
  const one = levelSpec(1);
  assert.equal(one.lesson, 'merge');
  // A single drop into the anchor slot completes level one.
  const drop = applyDrop(one.start, 0, c(0));
  assert.ok(drop.ok);
  assert.equal(resolve(drop.board).chain, 1, 'level 1 is not one drop from a merge');

  const two = levelSpec(2);
  assert.equal(two.lesson, 'rotate');
  // Level two cannot be finished without turning the ring: dropping at the
  // anchor as it starts makes no merge.
  const unturned = applyDrop(two.start, 0, c(1));
  assert.ok(unturned.ok);
  assert.equal(resolve(unturned.board).chain, 0, 'level 2 needs no rotation');
});

test('colour levels hand their colour to the bag, others hand nothing', () => {
  let colourLevels = 0;
  for (let id = 1; id <= 60; id++) {
    const spec = levelSpec(id);
    const colour = spec.objectives.find((o) => o.kind === 'colour');
    if (colour && colour.kind === 'colour') {
      colourLevels++;
      assert.equal(focusColour(spec), colour.colour);
    } else {
      assert.equal(focusColour(spec), undefined);
    }
  }
  assert.ok(colourLevels > 5, 'colour objectives never appear');
});

test('objective progress is clamped — it cannot read past the target', () => {
  const spec = levelSpec(1);
  const p = { ...newProgress(spec), merges: 50 };
  for (const o of spec.objectives) {
    assert.equal(objectiveDone(o, p), o.count);
  }
  assert.equal(completion(spec, p), 1);
});

test('completion averages objectives, so one untouched goal holds it down', () => {
  const spec = levelSpec(7); // merges + prisms
  assert.equal(spec.objectives.length, 2);
  const mergesOnly = { ...newProgress(spec), merges: 99 };
  assert.equal(
    completion(spec, mergesOnly),
    0.5,
    'a finished goal must not mask an unstarted one',
  );
  assert.equal(levelComplete(spec, mergesOnly), false);
});

test('applyMove counts pieces by colour, and prisms as no colour', () => {
  const spec = levelSpec(1);
  // Teal pair plus a prism: the run is three, but only two pieces are teal.
  const dropped: Board = [c(0), c(0), { prism: true }, null, null, null];
  const res = resolve(dropped);
  assert.equal(res.chain, 1);
  const p = applyMove(newProgress(spec), dropped, res);
  assert.deepEqual(p.cleared, [2, 0, 0]);
  assert.equal(p.merges, 1);
  assert.equal(p.drops, 1);
});

test('applyMove reads each cascade step from the board before that step', () => {
  // [B,B,B,A,A,A]: BBB clears, then AAA — six pieces over two steps.
  const dropped: Board = [c(1), c(1), c(1), c(0), c(0), c(0)];
  const res = resolve(dropped);
  assert.equal(res.chain, 2);
  const p = applyMove(newProgress(levelSpec(1)), dropped, res);
  assert.deepEqual(p.cleared, [3, 3, 0]);
  assert.equal(p.bestChain, 2);
});

test('a four-run counts toward a prism objective', () => {
  const dropped: Board = [c(2), c(2), c(2), c(2), null, null];
  const res = resolve(dropped);
  const p = applyMove(newProgress(levelSpec(7)), dropped, res);
  assert.equal(p.prisms, 1);
});

test('a level ends in a win or a full ring, and not before', () => {
  const spec = levelSpec(4);
  const empty = emptyBoard();
  const full: Board = [c(0), c(1), c(0), c(1), c(0), c(1)];

  const fresh = newProgress(spec);
  assert.equal(levelFailed(spec, fresh, empty), false, 'failed with room left');
  assert.equal(levelFailed(spec, fresh, full), true, 'survived a full ring');

  // Drops alone never fail a level — there is no move limit.
  const longGame = { ...fresh, drops: 10_000 };
  assert.equal(levelFailed(spec, longGame, empty), false);

  // A full ring on the drop that completes the level is a win.
  const done = { ...fresh, merges: 99 };
  assert.equal(levelFailed(spec, done, full), false);
  assert.equal(levelComplete(spec, done), true);
});

test('stars reward efficiency and always give at least one', () => {
  const spec = levelSpec(24);
  const at = (drops: number) => stars(spec, { ...newProgress(spec), drops });
  assert.equal(at(spec.par), 3);
  assert.equal(at(spec.par + 1), 2);
  assert.equal(at(spec.par * 10), 1);
  // Monotonic: using more drops never earns more stars.
  let prev = 3;
  for (let d = 1; d <= spec.par * 3; d++) {
    const s = at(d);
    assert.ok(s <= prev, `stars went up at ${d} drops`);
    prev = s;
  }
});

test('par rises with what a level asks for', () => {
  const mergeLevels = [4, 12, 24, 36, 48, 60].map(levelSpec);
  for (let i = 1; i < mergeLevels.length; i++) {
    assert.ok(
      mergeLevels[i].par >= mergeLevels[i - 1].par,
      `par fell from level ${mergeLevels[i - 1].id} to ${mergeLevels[i].id}`,
    );
  }
});

test('each idea is taught once, on the level where it first appears', () => {
  assert.equal(lessonFor(levelSpec(1)), 'merge');
  assert.equal(lessonFor(levelSpec(2)), 'rotate');

  const colour = firstLevelWith('colour');
  const prism = firstLevelWith('prisms');
  assert.ok(colour > 3 && prism > 3, 'new objectives arrive after the opening lessons');
  assert.equal(lessonFor(levelSpec(colour)), 'colour');
  assert.equal(lessonFor(levelSpec(prism)), 'prism');

  const taught = new Map<string, number>();
  for (let id = 1; id <= 120; id++) {
    const lesson = lessonFor(levelSpec(id));
    if (!lesson) continue;
    assert.ok(
      !taught.has(lesson),
      `${lesson} taught twice (${taught.get(lesson)} and ${id})`,
    );
    taught.set(lesson, id);
  }
  assert.deepEqual([...taught.keys()].sort(), ['colour', 'merge', 'prism', 'rotate']);
});

test('the clock starts generous, tightens slowly, and has a floor', () => {
  assert.equal(levelSpec(1).settle, LEVEL_SETTLE_START_MS);
  let previous = Infinity;
  for (let id = 1; id <= 400; id++) {
    const ms = levelSpec(id).settle;
    assert.ok(ms <= previous, `level ${id} gives more time than level ${id - 1}`);
    assert.ok(ms >= LEVEL_SETTLE_FLOOR_MS, `level ${id} is below the floor`);
    previous = ms;
  }
  // Slow on purpose: a tenth level still has most of the opening's time.
  assert.ok(levelSettleMs(10) > 5000);
  assert.equal(levelSettleMs(400), LEVEL_SETTLE_FLOOR_MS);
});
