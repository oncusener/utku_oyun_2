/**
 * sound.ts — the merge tones.
 *
 * Six struck-bar notes, one per link of a chain, so a cascade walks up a minor
 * pentatonic scale and resolves. They are synthesised rather than sourced —
 * see tools/generate-notes.py, which is committed so the timbre stays a
 * parameter rather than a binary nobody can change.
 *
 * Like the ads layer, every entry point here is safe to call when audio is not
 * available: a device with no audio route, a web preview, an initialisation
 * that failed. Sound is the least important thing in this game and must never
 * be a reason a merge does not happen.
 *
 * One player per note, created once. Re-creating a player per playback is what
 * makes game audio stutter, and the whole point of these tones is that they
 * arrive exactly on the beat of the burst.
 */

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

/** Indexed by chain link. Kept as literal requires so Metro bundles them. */
const SOURCES = [
  require('../../assets/audio/note-0.wav'),
  require('../../assets/audio/note-1.wav'),
  require('../../assets/audio/note-2.wav'),
  require('../../assets/audio/note-3.wav'),
  require('../../assets/audio/note-4.wav'),
  require('../../assets/audio/note-5.wav'),
];

/** Quiet on purpose: this plays under a haptic, not instead of one. */
const VOLUME = 0.45;

let players: AudioPlayer[] | null = null;
let enabled = true;

export function soundAvailable(): boolean {
  return players !== null;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

/**
 * Prepare the players. Resolves false — without throwing — when there is no
 * audio to prepare.
 */
export async function initSound(): Promise<boolean> {
  if (players) return true;

  try {
    // Play through the media route and stay silent when the phone is silenced:
    // a game someone opens on a train must not be the app that blares.
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      allowsRecording: false,
    });

    const created = SOURCES.map((source) => {
      const player = createAudioPlayer(source);
      player.volume = VOLUME;
      return player;
    });
    players = created;
    return true;
  } catch {
    players = null;
    return false;
  }
}

/** Sound the note for this link of a chain. Silently does nothing if it can't. */
export function playTone(chainIndex: number): void {
  if (!enabled || !players) return;

  const index = Math.max(0, Math.min(chainIndex, players.length - 1));
  const player = players[index];

  try {
    // Rewind first: a player that has already run to the end will not restart
    // on play() alone, which would silently drop every note after the first.
    void player.seekTo(0);
    player.play();
  } catch {
    // A tone that will not sound is not worth interrupting the game for.
  }
}

/** Release the native players. */
export function releaseSound(): void {
  if (!players) return;
  for (const player of players) {
    try {
      player.remove();
    } catch {
      // Already gone.
    }
  }
  players = null;
}
