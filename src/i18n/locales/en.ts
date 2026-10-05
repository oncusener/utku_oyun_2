/**
 * en.ts — English copy.
 *
 * The shape declared here is the contract: every other locale is type-checked
 * against it, so a missing or misspelt key is a compile error rather than a
 * "translation.missing" string discovered by a player.
 *
 * `{name}` is a placeholder filled by `format()`. Numbers are never glued onto
 * a string in code, because where a number sits in a sentence is the
 * translator's call — Turkish writes the percent sign first, for one.
 *
 * Labels are written as label + number ("MERGES 3") rather than as sentences
 * ("3 merges"), which is the design system's voice and also sidesteps plurals
 * entirely.
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
  map: {
    region: 'REGION {n}',
    level: 'LEVEL {n}',
    play: 'PLAY',
    nextUp: 'NEXT UP',
    hard: 'HARD',
    coins: 'COINS',
    endless: 'ENDLESS',
    locked: 'clear region {n} to open',
    previousRegion: 'previous region',
    nextRegion: 'next region',
  },
  objective: {
    merges: 'MERGES',
    prisms: 'PRISMS',
    colour0: 'TEAL',
    colour1: 'AMBER',
    colour2: 'VIOLET',
  },
  hud: {
    drops: 'DROPS',
    pause: 'pause',
    back: 'back to the map',
  },
  lesson: {
    merge: 'drag to turn the ring · let go to drop\nthree of one colour in a row merge',
    rotate: 'the pair is not under the drop point\nturn the ring first',
    colour: 'every piece of this colour you merge counts',
    prism: 'four in a row leave a prism behind\na prism matches any colour',
  },
  result: {
    complete: 'COMPLETE',
    ringFull: 'RING FULL',
    soClose: 'SO CLOSE',
    drops: 'DROPS',
    coinsEarned: 'COINS EARNED',
    balance: 'BALANCE {n}',
    alreadyCollected: 'already collected',
    newBest: 'NEW BEST',
    double: 'DOUBLE THE REWARD',
    ad: 'AD',
    next: 'NEXT LEVEL',
    map: 'BACK TO MAP',
    percent: '{n}%',
    goalProgress: 'GOAL PROGRESS',
    stillNeeded: 'STILL NEEDED',
    continue: 'CONTINUE',
    continueHint: 'the ring clears · progress stays',
    continueCoins: 'CONTINUE · {n} COINS',
    retry: 'TRY AGAIN',
    loading: 'loading…',
  },
  pause: {
    title: 'PAUSED',
    resume: 'RESUME',
    restart: 'RESTART',
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
