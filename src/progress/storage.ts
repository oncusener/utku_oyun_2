/**
 * storage.ts — the save file on disk.
 *
 * expo-file-system rather than AsyncStorage because it is already linked into
 * the native build; adding a storage module would mean another development
 * build for no gain. One small JSON file in the app's document directory.
 *
 * Writes go to a temporary file and are then moved over the real one, so a
 * crash or a killed app mid-write leaves the previous save intact instead of a
 * half-written file. On Android that move is a rename(2) and atomic. On iOS it
 * is not: expo-file-system deletes the destination and then moves, so a crash
 * in between leaves only the temporary file — which is complete by then, so
 * loading falls back to it. If anything still goes wrong, parseSave turns it
 * into a fresh save rather than a crash — losing progress is bad, failing to
 * open is worse.
 */

import * as FileSystem from 'expo-file-system';

import { newSave, parseSave } from './save.ts';
import type { Save } from './save.ts';

const FILE = 'halka-save.json';

function path(name: string): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${name}` : null;
}

async function read(name: string): Promise<Save | null> {
  const target = path(name);
  if (!target) return null;
  try {
    const info = await FileSystem.getInfoAsync(target);
    if (!info.exists) return null;
    return parseSave(JSON.parse(await FileSystem.readAsStringAsync(target)));
  } catch {
    return null;
  }
}

export async function loadSave(): Promise<Save> {
  return (await read(FILE)) ?? (await read(`${FILE}.tmp`)) ?? newSave();
}

export async function writeSave(save: Save): Promise<void> {
  const target = path(FILE);
  const temp = path(`${FILE}.tmp`);
  if (!target || !temp) return;
  try {
    await FileSystem.writeAsStringAsync(temp, JSON.stringify(save));
    await FileSystem.moveAsync({ from: temp, to: target });
  } catch {
    // A save that cannot be written is not a reason to interrupt play.
  }
}
