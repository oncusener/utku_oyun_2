/**
 * i18n — two languages, no dependency.
 *
 * A translation library would be several hundred kilobytes to solve problems
 * this game does not have: no pluralisation (labels are written as label +
 * number, never as sentences), interpolation that `format()` covers in five
 * lines, no date formatting. What it does need is that a missing key cannot
 * ship, and that is a type constraint rather than a runtime one — see
 * `locales/tr.ts`, which is declared as `Copy` and fails to compile if it drifts
 * from English.
 *
 * The device locale is the default and it is right almost always. A choice made
 * with the in-app toggle is remembered in the save file (see App.tsx); this
 * module only holds the current value and does not know about storage.
 */

import { en } from './locales/en.ts';
import { tr } from './locales/tr.ts';
import type { Copy } from './locales/en.ts';

export type Language = 'en' | 'tr';
export type { Copy };

const CATALOGUE: Record<Language, Copy> = { en, tr };

export const LANGUAGES: readonly Language[] = ['en', 'tr'];

/**
 * Map an arbitrary BCP-47 tag onto a language we actually have.
 * Exported so it can be tested without booting the native locale module.
 */
export function resolveLanguage(tags: readonly (string | null | undefined)[]): Language {
  for (const tag of tags) {
    if (!tag) continue;
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (primary === 'tr') return 'tr';
    if (primary === 'en') return 'en';
  }
  return 'en';
}

let current: Language = 'en';
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

export function setLanguage(next: Language): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function toggleLanguage(): void {
  setLanguage(current === 'en' ? 'tr' : 'en');
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active catalogue. Components read this through `useCopy()`. */
export function copy(): Copy {
  return CATALOGUE[current];
}

/** Called once at startup with the device's preferred locales. */
export function initLanguage(tags: readonly (string | null | undefined)[]): Language {
  current = resolveLanguage(tags);
  return current;
}

/**
 * Fill `{name}` placeholders. Deliberately tiny: the catalogue stays plain
 * strings, so the parity and "not left in English" tests keep working, and a
 * translator can move a number anywhere in the sentence — Turkish puts it in a
 * different place from English more often than not.
 */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}
