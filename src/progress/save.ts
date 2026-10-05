/**
 * save.ts — what the game remembers between launches, as pure data.
 *
 * Halka used to remember nothing: no score, no streak, no settings file, by
 * design. Levels end that. A map you cannot return to is not a map, and coins
 * you lose on every launch are not coins. This is the smallest record that
 * makes the level structure honest: how far you have got, how well you did on
 * each level, what you are holding, and which language you chose.
 *
 * Every function here is pure. Reading and writing the file is storage.ts; this
 * module decides what a save *means*, which is the part worth testing.
 */

import type { LevelSpec } from '../game/levels.ts';

export const SAVE_VERSION = 1;

/** What continuing a failed level costs, in coins. About two early levels' pay. */
export const CONTINUE_COST = 60;

export type Stars = 1 | 2 | 3;

export type Save = {
  version: typeof SAVE_VERSION;
  /** The highest level the player may start. Always at least 1. */
  unlocked: number;
  /** Best stars per level id. A level absent here has never been won. */
  stars: Record<number, Stars>;
  coins: number;
  language: 'en' | 'tr' | null;
};

export function newSave(): Save {
  return { version: SAVE_VERSION, unlocked: 1, stars: {}, coins: 0, language: null };
}

export type WinResult = {
  save: Save;
  /** Coins actually paid for this win — zero on a replay that improves nothing. */
  paid: number;
  firstClear: boolean;
  improved: boolean;
};

/**
 * Record a won level.
 *
 * The full reward is paid once, on the first clear. Replays pay only for stars
 * they add, at a third of the reward per star. Without that rule the first
 * level becomes a coin farm and every price in the game is meaningless; with it,
 * going back for three stars is still worth something.
 */
export function recordWin(save: Save, spec: LevelSpec, earned: Stars): WinResult {
  const previous = save.stars[spec.id];
  const firstClear = previous === undefined;
  const improved = firstClear || earned > previous;

  let paid = 0;
  if (firstClear) paid = spec.reward;
  else if (earned > previous) paid = Math.round((spec.reward / 3) * (earned - previous));

  return {
    save: {
      ...save,
      unlocked: Math.max(save.unlocked, spec.id + 1),
      stars: improved ? { ...save.stars, [spec.id]: earned } : save.stars,
      coins: save.coins + paid,
    },
    paid,
    firstClear,
    improved,
  };
}

export function addCoins(save: Save, amount: number): Save {
  if (!Number.isFinite(amount) || amount <= 0) return save;
  return { ...save, coins: save.coins + Math.floor(amount) };
}

/** Spend coins if there are enough. Never lets the balance go negative. */
export function spendCoins(save: Save, amount: number): { ok: boolean; save: Save } {
  if (!Number.isFinite(amount) || amount < 0 || save.coins < amount) {
    return { ok: false, save };
  }
  return { ok: true, save: { ...save, coins: save.coins - amount } };
}

export function totalStars(save: Save): number {
  return Object.values(save.stars).reduce((sum, s) => sum + s, 0);
}

/**
 * Turn whatever came off disk into a valid save.
 *
 * The file can be missing, truncated by a crash mid-write, from an older
 * version, or edited by hand. None of those may stop the game from opening, and
 * none may hand the player a negative balance or level zero. Anything that does
 * not look right is replaced with its default rather than trusted.
 */
export function parseSave(raw: unknown): Save {
  const base = newSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;

  const unlocked =
    typeof r.unlocked === 'number' && Number.isInteger(r.unlocked) && r.unlocked >= 1
      ? r.unlocked
      : base.unlocked;

  const coins =
    typeof r.coins === 'number' && Number.isFinite(r.coins) && r.coins >= 0
      ? Math.floor(r.coins)
      : base.coins;

  const stars: Record<number, Stars> = {};
  if (r.stars && typeof r.stars === 'object') {
    for (const [key, value] of Object.entries(r.stars as Record<string, unknown>)) {
      const id = Number(key);
      if (Number.isInteger(id) && id >= 1 && (value === 1 || value === 2 || value === 3)) {
        stars[id] = value;
      }
    }
  }

  const language = r.language === 'en' || r.language === 'tr' ? r.language : null;

  // A star on a level beyond the unlock frontier means the frontier is wrong,
  // not the star: winning a level always unlocks the next one.
  const highestWon = Math.max(0, ...Object.keys(stars).map(Number));

  return {
    version: SAVE_VERSION,
    unlocked: Math.max(unlocked, highestWon + 1),
    stars,
    coins,
    language,
  };
}
