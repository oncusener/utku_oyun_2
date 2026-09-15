/**
 * en.ts — English copy.
 *
 * The shape declared here is the contract: every other locale is type-checked
 * against it, so a missing or misspelt key is a compile error rather than a
 * "translation.missing" string discovered by a player.
 */

export const en = {
  sessionEnd: {
    level: 'LEVEL',
    merges: 'MERGES',
    chain: 'CHAIN',
    again: 'tap anywhere to begin again',
    revive: 'watch an ad to clear the ring',
    reviveLoading: 'loading…',
  },
  language: {
    /** Shown on the toggle as the language you would switch *to*. */
    switchTo: 'TR',
  },
} as const;

/**
 * Widen the literal types away, keeping only the shape.
 *
 * `en` is `as const` so its keys are exact, but a locale must be free to say
 * something different — without this, `Copy` would demand the English strings
 * verbatim and every translation would be a type error. English stays the one
 * source of truth for the *structure*: add a key here and `tr.ts` stops
 * compiling until it is translated.
 */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Copy = Widen<typeof en>;
