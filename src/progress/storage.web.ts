/**
 * storage.web.ts — the save file, in the browser preview.
 *
 * expo-file-system has no document directory on web, so without this every
 * reload of the preview would be a first launch. localStorage is synchronous
 * and one key is all a save needs. Same contract as storage.ts: never throws,
 * and anything unreadable becomes a fresh save.
 */

import { newSave, parseSave } from './save.ts';
import type { Save } from './save.ts';

const KEY = 'halka-save';

export async function loadSave(): Promise<Save> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? parseSave(JSON.parse(raw)) : newSave();
  } catch {
    return newSave();
  }
}

export async function writeSave(save: Save): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or a full quota: play on without saving.
  }
}
