/**
 * i18n.test.ts — locale parity and language resolution.
 *
 * The parity test is the one that earns its keep: TypeScript already refuses a
 * `tr.ts` that is missing a key, but it cannot see an empty string or a key
 * left in English by accident, and either of those ships silently.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LANGUAGES,
  copy,
  getLanguage,
  initLanguage,
  resolveLanguage,
  setLanguage,
  subscribe,
  toggleLanguage,
} from './index.ts';
import { en } from './locales/en.ts';
import { tr } from './locales/tr.ts';

type Nested = { [key: string]: string | Nested };

function paths(obj: Nested, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : paths(value, `${prefix}${key}.`),
  );
}

function valueAt(obj: Nested, path: string): string {
  const value = path
    .split('.')
    .reduce<string | Nested>((acc, key) => (acc as Nested)[key], obj);
  assert.equal(typeof value, 'string', `${path} is not a string`);
  return value as string;
}

test('every English key exists in Turkish, and vice versa', () => {
  const enPaths = paths(en as unknown as Nested).sort();
  const trPaths = paths(tr as unknown as Nested).sort();
  assert.deepEqual(trPaths, enPaths);
});

test('no translation is blank or left in English', () => {
  for (const path of paths(en as unknown as Nested)) {
    const english = valueAt(en as unknown as Nested, path);
    const turkish = valueAt(tr as unknown as Nested, path);

    assert.ok(turkish.trim().length > 0, `${path} is blank in Turkish`);
    // The language toggle is a language *code*, so it is meant to differ from
    // its English counterpart without being a translation of it.
    if (path === 'language.switchTo') continue;
    assert.notEqual(turkish, english, `${path} was never translated`);
  }
});

test('resolveLanguage reads the device preference list in order', () => {
  assert.equal(resolveLanguage(['tr-TR']), 'tr');
  assert.equal(resolveLanguage(['en-GB']), 'en');
  assert.equal(resolveLanguage(['tr']), 'tr');
  assert.equal(resolveLanguage(['TR_tr']), 'tr');
  // First supported entry wins, not the first entry.
  assert.equal(resolveLanguage(['de-DE', 'tr-TR', 'en-US']), 'tr');
  assert.equal(resolveLanguage(['fr-FR', 'en-US']), 'en');
});

test('resolveLanguage falls back to English rather than failing', () => {
  assert.equal(resolveLanguage([]), 'en');
  assert.equal(resolveLanguage([null, undefined, '']), 'en');
  assert.equal(resolveLanguage(['zh-Hans-CN']), 'en');
});

test('setting the language swaps the catalogue and notifies subscribers', () => {
  initLanguage(['en-US']);
  assert.equal(getLanguage(), 'en');
  assert.equal(copy().sessionEnd.level, en.sessionEnd.level);

  let notified = 0;
  const unsubscribe = subscribe(() => {
    notified++;
  });

  setLanguage('tr');
  assert.equal(getLanguage(), 'tr');
  assert.equal(copy().sessionEnd.level, tr.sessionEnd.level);
  assert.equal(notified, 1);

  // Setting the language it already is must not churn subscribers.
  setLanguage('tr');
  assert.equal(notified, 1);

  toggleLanguage();
  assert.equal(getLanguage(), 'en');
  assert.equal(notified, 2);

  unsubscribe();
  toggleLanguage();
  assert.equal(notified, 2, 'unsubscribed listener still fired');

  initLanguage(['en-US']);
});

test('LANGUAGES lists exactly what the catalogue can serve', () => {
  assert.deepEqual([...LANGUAGES].sort(), ['en', 'tr']);
  for (const language of LANGUAGES) {
    setLanguage(language);
    assert.equal(typeof copy().sessionEnd.again, 'string');
  }
  initLanguage(['en-US']);
});
