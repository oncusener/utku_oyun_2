# Halo

A one-thumb ring puzzle. Six slots, three colours, one piece at a time.

Drag anywhere horizontally to turn the ring; 48px turns it one 60° detent. Let
go — or let the settle arc run out — and the piece drops into whichever slot is
under the anchor at 12 o'clock.
Three or more of a colour in a row merge, the survivors fall counter-clockwise
into the hole, and sometimes that lands another three together.

Two ways to play. **Levels** give the ring a stated goal — make four merges,
clear nine teal pieces, condense a prism — and end when the goal is met or the
ring fills; stars for doing it in few drops, coins for clearing it, a map of
twelve-level regions. **Endless** is the original game: no goal, a clock that
tightens every eight merges, and a score.

Built to be put down. No account, no streak, no notification. Levels remember
where you got to; endless remembers nothing.

## Running it

```bash
npm install
```

```bash
npm start
```

Then press `a` for Android, or scan the QR with Expo Go (SDK 53). Skia's native
half ships inside Expo Go at the version pinned here, so the game itself needs
no custom build — only the ads do.

### Two ways to run, and why it matters

|           | Expo Go           | Development build               |
| --------- | ----------------- | ------------------------------- |
| command   | `npm run android` | `npm run android:dev`           |
| the game  | complete          | complete                        |
| ads       | **absent**        | real (test units)               |
| first run | seconds           | a Gradle build, tens of minutes |

**AdMob is a native module, and Expo Go cannot load native modules it was not
built with.** That is not a bug to be worked around, it is the boundary of what
Expo Go is. So the ads layer is written to answer "no ads" without complaint:
every entry point in `src/ads` is safe to call when the SDK is missing, and
nothing downstream may treat that as an error. Day-to-day development happens in
Expo Go, where iteration takes seconds; ads are verified in a development build.

If the reward button never appears, that is the intended behaviour in Expo Go,
not a failure.

### Android emulator

```bash
npm run android
```

Starts Metro on 8081 and launches the app on whatever emulator `adb` can see.
Note the explicit `--go` in that script: installing `expo-dev-client` silently
changes the default launch target to a development build, so the Expo Go path
has to be asked for by name.
The shared helper one directory up does the same thing:

```bash
../emu.sh start && ../emu.sh expo halo
```

Expo Go must match the project's SDK, and the store version tracks the newest
SDK rather than this one. For SDK 53 that is Expo Go **2.33.22** — look the
right build up rather than guessing:

```bash
curl -s https://api.expo.dev/v2/versions/latest | python3 -c "import json,sys;print(json.load(sys.stdin)['sdkVersions']['53.0.0']['androidClientUrl'])"
```

Install the downloaded APK with `adb install -r <file>.apk`. Note that the
emulator's `localhost` is not the host's, so a locally served bundle needs
`adb reverse tcp:8081 tcp:8081` — `expo start --android` sets this up itself.

### Seeing it without a phone

There is a web target, purely for previewing on a machine with no simulator:

```bash
npm run web
```

Skia on web is CanvasKit, so `public/canvaskit.wasm` has to exist — `npm run
web:setup` copies it out of `node_modules`. It is gitignored, being a build
artefact. `metro.config.js` serves `.wasm` and sets the cross-origin isolation
headers CanvasKit wants, and turns off watchman, which macOS privacy protection
blocks under `~/Downloads`. None of it touches the iOS or Android bundle.

Treat web as a looking glass, not the game: there are no haptics, and a mouse
drag is not a thumb.

## Tests

The engine is pure TypeScript with no React Native imports, so it runs directly
under Node's test runner — no jest, no bundler, no config.

```bash
npm test
```

94 tests across the engine, the level generator, the save file, the ad policy,
the scale and the locales. The exhaustive ones
are the load-bearing set: they walk all 5⁶ = 15,625 reachable boards and assert
that `resolve` always terminates on a stable ring, that pieces are never lost or
invented, that survivors only ever slide counter-clockwise, and that a reported
near miss is genuinely two-plus-a-reachable-third.

Everything under test is deliberately free of React and of native modules —
`engine.ts`, `levels.ts`, `save.ts`, `policy.ts`, `scale.ts`, `i18n/index.ts` —
which is why the suite
needs no bundler, no jest and no mocking. That constraint is worth defending:
moving the chain-scale mapping into `feedback.ts`, which imports `expo-haptics`
and `expo-audio`, broke the whole engine suite in one commit.

```bash
npm run verify   # typecheck + tests + lint
```

## How it fits together

```
src/
  App.tsx                  fonts, the save, and which of three screens is up
  bootstrap.native.ts      iOS/Android entry
  bootstrap.web.ts         browser entry — loads CanvasKit, then mounts
  screens/
    LevelMap.tsx           regions of twelve, stars, the play button
    LevelScreen.tsx        one level: Game + HUD + pause + result, coins, ads
    LevelHud.tsx           level, objectives, stars on track, lesson line
    LevelResult.tsx        win (stars, coins, double) and loss (continue, retry)
    EndlessScreen.tsx      the original game plus a way back to the map
    objectives.tsx         one name and one mark per objective, everywhere
    insets.ts              fixed notch / home-indicator clearances
  progress/
    save.ts                the save model — pure: rewards, coins, parsing
    storage.ts             one JSON file, written atomically (web: .web.ts)
    save.test.ts
  game/
    Game.tsx               Skia canvas, pan gesture, level and endless rounds
    engine.ts              ring rules — pure, deterministic, no RN imports
    engine.test.ts         node:test suite
    levels.ts              level generator, objectives, stars — pure
    levels.test.ts
    bag.ts                 weighted draw, seedable, can favour a colour
    difficulty.ts          level -> settle duration, and how much luck to arrange
    feedback.ts            haptics, and every timing constant
    scale.ts               which note a chain link sounds — pure
    sound.ts               the tone players
    theme.ts               colours, geometry, fonts, surfaces
  components/
    SessionEnd.tsx         end of an endless run
    ui.tsx                 buttons, panels, coin and star marks
  i18n/
    index.ts               language state, resolution, subscription
    useCopy.ts             the React binding
    device.ts              seeds the language from the phone
    locales/en.ts          English — and the shape every locale must match
    locales/tr.ts          Türkçe
    i18n.test.ts
  ads/
    index.ts               the entire surface the game may touch
    policy.ts              when an ad is allowed to interrupt — pure
    adUnits.ts             which unit id, test or live
    native.ts              resolve the SDK, or decide it isn't there
    consent.ts             UMP + iOS ATT — off unless the user agrees
    policy.test.ts
assets/audio/            six generated tones
tools/
  generate-notes.py      renders them; committed so the timbre stays editable
```

**The board lives in a shared value, not in React state.** The ring never
re-renders to show a move: rotation, drop, burst, collapse, the near-miss lean
and the board itself are shared values read from worklets on the UI thread. In
level mode the HUD around it does re-render once per move to update its counts,
which is why `Game` is memoised and handed stable callbacks — the ring sits that
render out.

That is a correctness decision as much as a performance one. A collapse changes
the board _and_ starts the animation that explains the change. If the board went
through a React commit, the two would land on different frames and pieces would
visibly teleport before sliding. Writing both shared values in the same JS tick
puts them in the same UI-thread batch.

Game logic stays on the JS thread, where it is event-driven rather than
per-frame, which is what lets `engine.ts` be plain testable TypeScript.

**The entry point is split per platform,** and that split is load-bearing rather
than tidiness. Metro follows every `require` it can see, regardless of which
branch can actually run, so a `Platform.OS === 'web'` guard around the CanvasKit
import still dragged the whole browser wasm loader into the Android bundle.
Separate `bootstrap.native.ts` / `bootstrap.web.ts` files let the bundler decide
by filename instead. `tsconfig` sets `moduleSuffixes` so tsc resolves the pair
the same way.

## Rules worth knowing about

**Merges resolve one run at a time.** Not every run at once — that distinction is
the only reason cascades exist. On a six-slot ring the complement of a cleared
run is itself contiguous, so clearing everything simultaneously could never
reveal a second match. `[B,B,B,A,A,A]` chains to 2 precisely because BBB goes
first and the three A's are rediscovered after they slide together.

**Collapse fills the hole the run left.** Survivors are packed against the
counter-clockwise-most slot of the cleared run, swallowing any pre-existing gaps
on the way down. Nothing ever moves clockwise; the renderer draws each piece at
the angle it came from and eases it home.

**A prism matches any one colour** but cannot bridge two different ones.
`[red, prism, red]` merges; `[red, prism, blue]` does not.

**A run of four or more condenses into a prism.** This is the only real reward
in the game and it carries two jobs. A four-run cannot be assembled gradually —
the instant three of a colour touch they merge — so the only way to make one is
to leave a deliberate gap between a pair and a single and then fill it. That is
the one genuinely skilful thing the ring asks of you, and before this it paid
exactly what a lazy three paid.

It is also the only reason cascades exist. A chain needs a collapse to reveal a
second run, which on six slots means the survivors must already share a colour —
a board legal play can never build, because the earlier triple would have merged
first. The prism is wild, so it completes a run with whatever two survivors it
lands beside.

**The bag reads the board.** It tilts toward a colour you can actually use:
strongly if that colour would merge right now, less so if it only has a pair or
a single to grow from. It is a tilt, never a guarantee — the other colours keep
their full base weight, so it reads as luck rather than as the game playing
itself.

**Difficulty is how much luck the game arranges for you,** not how fast the
clock runs. Level scales the bag's helpfulness from 1 down to a floor of 0.18;
the settle timer still tightens, but it was never what killed anybody. Six slots
fill long before anyone runs out of thinking time, so tightening only the clock
made the game harsher along the one axis that was not the problem.

**Endless level is derived from merges,** `1 + floor(merges / 8)`, rather than
incremented on `merges % 8 == 0`. A three-chain adds three merges at once and the
modulo test would skip the level entirely.

## Levels

A level is "reach this goal before the ring fills". Three kinds of goal —
merges, pieces of one colour, prisms — and every level is a pure function of its
number (`levelSpec(id)` in `levels.ts`): no data file, no level that can be
missing, and the whole curve re-tunes by editing arithmetic. Twelve levels make
a region. Every fifth level from the seventh on is marked hard and asks for one
more, but never the first of a region.

**There is no move limit. The ring is what you lose to.** The Stitch mock-ups had one
("KALAN HAMLE", "+3 HAMLE"), and it was built and simulated before being taken
out: on a six-slot ring, with the budget anywhere near fair, the ring fills
before the moves run out every time — 150 losses to a full ring for every 0 to
an empty budget. A counter that never reaches zero is decoration, and worse, it
tells the player they are safe right up until they lose to something it never
showed them. Every drop adds a piece and only a merge removes any, so a level
cannot stall: it ends in a win or a full ring. Drops still count — toward stars.

**Stars are calibrated, not reasoned.** Three stars at par, two within a margin.
The first par formula handed three stars to 81% of wins, which makes them
meaningless; the constants now are fitted to the drops the most efficient third
of simulated wins actually used, and wins split 59% / 33% / 8% across three, two
and one star.

What simulation changed, 200 attempts per level by the same one-ply AI:

| problem found                                   | fix                                           | result                    |
| ----------------------------------------------- | --------------------------------------------- | ------------------------- |
| colour goals were a lottery                     | the bag leans toward the wanted colour        | first colour level 32→86% |
| a "make a chain" goal was luck, not skill       | removed                                       | was 4–7%                  |
| opening levels stuck at 86% whatever the budget | levels 1–3 start on a hand-laid teaching ring | 99 / 99 / 98%             |
| the move limit never bound                      | removed; drops feed stars instead             | 150 : 0 → n/a             |

The curve that came out: levels 1–10 average 85%, 11–30 68% (about one and a
half attempts), 31–60 45% (about 50% normal, 27–40% hard). No level in the first
sixty was unwinnable.

Each idea is taught once, where it first appears. Levels 1 and 2 are laid out
by hand — a pair beside the anchor, then a pair round the back that cannot be
finished without turning the ring — and the first colour and first prism levels
show one line of instruction until the idea has worked once. `lessonFor` asks
the generator where each idea first turns up rather than hard-coding it.

**The settle arc still runs in levels.** It was taken out once, on the theory
that a puzzle should let you think as long as you like, and the game went slack:
with unlimited time every drop can be checked against every rotation, and the
ring stops being something you play with your thumb. So each level has its own
clock — 6.5s a piece on level 1, losing 2.5% a level down to a 3s floor, far
gentler than endless's 7% — and the pause button stops it.

Running out of time costs the choice of where the piece lands, never the level:
if the anchor is over a taken slot when the arc ends, the ring turns itself to
the nearest free slot and the piece drops there. Letting go over a taken slot
yourself is a slip of the thumb rather than a decision, so the piece bumps and
stays in hand — and the clock carries on from where it was, so a slip buys no
time. Only endless treats either as the end of the run.

The simulated win rates above come from a player with no clock; a human against
the arc will sit somewhat below them, most on the later levels.

## Progress

Levels keep a save: the highest level unlocked, the stars per level, coins, and
the language if one was chosen. It is one small JSON file in the app's document
directory (`localStorage` on web). Writes go to a temporary file first; on
Android the move over the real file is an atomic rename, on iOS expo-file-system
deletes then moves, so loading falls back to the temporary file if a crash lands
in between. Anything unreadable — truncated, hand-edited, an older version —
is repaired or replaced by `parseSave` rather than trusted, and never stops the
game opening.

Coins come from clearing a level the first time. Replaying pays only for stars
the replay adds, a third of the reward per star, so level 1 is not a coin farm.
Coins buy one thing so far: a continue after the ring fills, 60 coins, once per
attempt — the ring empties and the progress toward the goal stays. The same
continue is offered for a rewarded ad.

## Design

The screens around the ring follow the Stitch export in
`stitch_halka_mobile_game_ui_kit/` and its design system (`calibrated_precision/
DESIGN.md`): the existing palette, Space Grotesk in light weights for numbers,
JetBrains Mono in spaced capitals for labels, hairline borders instead of
shadows, one filled button per screen, controls in the lower part of the screen.
The fonts load at startup; nothing draws until they have.

Taken from the mock-ups: the region map with filled, current and locked nodes,
the win screen's stat row and coin panel, the "so close" loss screen built around
one big percentage, the double-reward and continue offers.

Left out, on purpose:

- **Every label in both languages at once** ("DÖNDÜR // ROTATE"). The game has
  a language toggle; saying everything twice halves the room for saying it.
- **The gameplay HUD's eleven readouts** — score, best, streak, azimuth, a
  rotate slider, a "release to drop" button, hint and mute buttons. The ring is
  the interface. What survived is what the ring cannot show: level, goal,
  progress, whether three stars are still possible, and pause.
- **The move counter and "+3 moves"**, for the reasons under Levels.
- **Invented region lore and version strings** ("OPTİK REZONANS HATTI",
  "SYS.V.3.1").
- **Shop, daily reward and settings screens.** A shop needs store products that
  do not exist yet; a daily reward is a retention mechanic the brief rates below
  a clear goal, which is what levels are; the only setting is the language, and
  that is a toggle on the map.

## Language

English and Turkish, chosen from the device's own preference list at startup,
with a toggle on the map and on the endless end screen for when that guess is
wrong.

There is no i18n library. One would be several hundred kilobytes to solve
problems this game does not have. Labels are written as label + number
("MERGES 3"), which is the design system's voice and means there is nothing to
pluralise; the few numbers inside sentences go through a five-line `format()`
with `{n}` placeholders, so a translator decides where the number sits — Turkish
writes `%94`, not `94%`. What it does need is
that a missing translation cannot ship, and that is a type constraint rather
than a runtime one: `locales/tr.ts` is declared as `Copy`, a widened version of
the English catalogue's shape, so adding an English key breaks the build until
Turkish has one too. Tests cover what types cannot — blank strings, strings left
in English by accident, and a translation that drops a `{n}` its English
original has.

A language picked with the toggle is remembered in the save file. One that was
never picked is not written down, so a player who never touches the toggle keeps
following their phone.

## Ads

An interstitial on a cadence, and an optional rewarded interstitial. In endless
the reward clears the ring and the run continues. In a level it is either the
continue after a full ring or, on a win, doubling the coins the level paid.

A level's end counts as a session for the cadence, and the choice between the
two ads is the same `chooseAdMoment` call. What differs is when an interstitial
plays: not over the result screen, but when the player leaves it — next level,
retry, or back to the map. A win should get to be a win before anything
interrupts it, and choosing to continue cancels a pending interstitial rather
than following the continue with one.

**Consent comes before the first ad request, not after.** `consent.ts` runs
Google's UMP form and then, on iOS, the App Tracking Transparency prompt — in
that order, because that is the order Google requires. Personalisation is asked
for only when both say yes; miss either one and every request carries
`requestNonPersonalizedAdsOnly`, which is also what you get if the whole flow
throws. `initAds` awaits it before it initialises the SDK or preloads anything,
so there is no window where an ad could be requested ahead of consent — and the
gate is that await, not a flag the UI reads. The only ad buttons Halo shows —
continue, double the reward — appear only once an ad has already loaded, which
cannot happen before consent.
Like the rest of the layer it is safe in Expo Go: it is only entered once a real
native module has resolved, which never happens there. This mirrors orbeat and
zenly; unlike zenly it carries no store, since nothing renders off the result.

`policy.ts` is the part worth reading, and it is deliberately pure so it can be
tested. Halo is meant to be played standing on a subway and put down without a
thought, so the rules protect that: never during the opening sessions, then at
most one interstitial every few games, and never twice inside a two-minute
cooldown however many games are lost in between. A test plays out forty
four-second losing runs and asserts the player is not buried in ads.

The two paths are mutually exclusive. Being shown an interstitial _and_ then
asked to watch a rewarded ad is two interruptions at the single moment someone
is deciding whether to keep playing, so when the reward is offered the
interstitial is skipped. One continue per run, so a good run still ends.

Ad unit ids default to Google's test units, and that default is a safety
property rather than a convenience: serving live ads to your own emulator is how
AdMob accounts get suspended for invalid traffic, so the safe value is the one
you get by doing nothing. Real ids come from the environment — see
`.env.example`. They are not secrets (they ship inside the binary) but keeping
them in env stops a fork from serving impressions to this project's account.

`show()` resolves when the ad is _presented_, not when it is done with. Reading
the reward flag straight after awaiting it therefore always reads it too early:
the player watches the whole ad, the SDK grants the reward, and the game gives
nothing back. The completion signal is `CLOSED`, and `EARNED_REWARD` is what
must have fired before it. This is only findable by watching a real ad through
to the end — it looks correct in review, and Expo Go can never reach the code
path at all.

The app ids are passed as _plugin props_ in `app.config.ts`. The config plugin
reads nothing else — there is no fallback to a top-level config key — and an
undefined `androidAppId` makes the Google SDK crash the app on launch, so this
is a mistake that surfaces at runtime rather than at build time.

## Sound

Six struck-bar tones, one per link of a chain, so a cascade walks up a minor
pentatonic scale and resolves. Nothing plays on a failed drop, and nothing plays
on a near miss — that one is deliberately silent so it registers as a feeling
rather than an event.

The tones are **synthesised, not sourced**: `tools/generate-notes.py` renders
them from a sine stack with an exponential decay, and it is committed alongside
the `.wav` files it produces. That keeps the repository clear of third-party
audio licensing, and it makes the timbre a parameter anyone can change rather
than a binary nobody can. Re-run it after editing and the notes regenerate.

Like the ads layer, sound degrades to silence rather than to an error: no audio
route, a failed init, or a web preview all end up with `playTone` doing nothing.
Sound is the least important thing here and must never be why a merge fails.

The scale mapping lives in `scale.ts` rather than beside the player, and that
separation is load-bearing: the engine suite runs under plain Node with no
bundler, so a pure design decision cannot sit in a file that imports
`expo-audio`.

## iOS

Played in the iOS Simulator (iPhone 17, iOS 26.5) through Expo Go 2.33.17,
the SDK 53 build. Not yet on a physical iPhone, and not as a development build,
so ads on iOS are still unverified.

```bash
npx expo start --ios --go
```

If Xcode lives anywhere other than `/Applications`, `expo start --ios` fails with
"Can't determine id of Simulator app": the CLI looks Simulator up by name
through Launch Services, which only knows about apps it has seen. Registering it
once fixes that —
`lsregister -f <Xcode>.app/Contents/Developer/Applications/Simulator.app` — and
`xcode-select` has to point at that Xcode as well. The CLI also asks macOS for
permission to script System Events so it can raise the Simulator window; without
it, it exits after installing Expo Go. `npx expo start --go` plus
`xcrun simctl openurl booted exp://127.0.0.1:8081` sidesteps that.

What was checked, by prebuilding and reading the generated `Info.plist`:
`GADApplicationIdentifier` is injected correctly, which is the entry whose
absence crashes the Google SDK on launch.

The consent flow adds one more iOS-only dependency: `NSUserTrackingUsageDescription`,
without which the ATT prompt cannot appear and iOS personalisation stays off.
It is set by the `expo-tracking-transparency` plugin and confirmed in the
resolved `expo config`; it has **not** yet been read back out of a prebuilt
`Info.plist`.

One gap is left deliberately open. `SKAdNetworkItems` lists only Google's own
identifier. iOS 14+ attributes installs through SKAdNetwork and a network absent
from that list cannot be credited, so the ~100 partner identifiers should be
copied from [Google's published
list](https://developers.google.com/admob/ios/quick-start#skadnetwork) before an
iOS release. They are not written here because they change over time and would
have to be guessed rather than known. Missing entries cost attribution, never
correctness — the app runs and serves ads either way, which is precisely why
this is easy to ship without noticing.

## Deliberate gaps

**No safe-area library.** One would be a new native module and so a new
development build for every tester, to position half a dozen labels.
`screens/insets.ts` holds fixed clearances for the camera cutout and the home
indicator, which fit current phones; a device that needs more will show it at
the edges of the map and the result screens first.

**The Zeigarnik hook reframes rather than rearranges.** The brief asks the final
board to show an adjacent same-coloured pair, rotating the ring offset if needed.
Rotation cannot actually do that: adjacency lives in the board indices, and the
board freezes the instant a drop lands on an occupied slot, so no offset creates
a neighbouring pair — and piece identities must not be touched. What the offset
_can_ control is where on the dial the board's most complete run sits, so
`zeigarnikOffset` parks it under the anchor at 12 o'clock, preferring a near-miss
pair, then any adjacent pair, then the two closest same-coloured pieces. The last
thing on screen is an almost-merge, framed where the eye already is.

## Balance

The engine is pure, so a few thousand games can be played headlessly by an AI
with one ply of lookahead. That is how the two rules above were chosen rather
than guessed. Before and after, 4000 games each:

|                             | before | after |
| --------------------------- | ------ | ----- |
| median turns                | 15     | 30    |
| mean turns                  | 20.3   | 38.0  |
| median score                | 3      | 8     |
| games reaching a 2-chain    | 0.0%   | 17.9% |
| games ending under 10 turns | 31.9%  | 14.6% |

The first build was a death march: half of all games were over in 15 drops, and
a 2-chain — the entire reason scoring is triangular — was **never once reached**
in 4000 games, because legal play cannot build the board it requires.

The skill claim is measured too, not assumed. An AI that deliberately hunts for
four-runs earns 0.40 prisms per game against 0.21 for one that ignores them, and
sees a four-run in 27.7% of games against 17.6%. So the setup is a learnable
edge rather than a lottery.

Worth knowing if you retune: making _every_ merge condense (`PRISM_RUN_LENGTH =
3`) collapses the game completely — the ring turns to prism soup and the median
game runs 306 turns, to a maximum of 3248.

## Verified

Typecheck clean, 95/95 tests passing, the app bundles through Metro (1406
modules), and it has
been played in the browser: rotation and snapping, tap-to-drop and drag-to-drop,
a three-in-a-row merge with the survivors collapsing counter-clockwise into the
exact slots the engine predicts, a four-run condensing into a prism, the
board-full ending, `SessionEnd`, and restart.

Also run on an Android emulator (Pixel 8, API 36) two ways. Through Expo Go
2.33.22: renders correctly at 1080x2400, tap-to-drop and swipe-to-rotate both
register, both languages display, and the ads layer stays silently absent with
no errors. And through a development build: AdMob initialises, a rewarded
interstitial loads and presents as a Google test ad, the reward is granted, and
the run continues on a cleared ring.

The level shell has been played in the iOS Simulator: first launch opening
straight into level 1, the map with cleared, current and locked nodes and the
coin balance, the HUD, the settle arc running down and dropping the piece, a
timed-out drop over a taken slot turning the ring to the nearest free slot,
pause freezing the arc and resume picking it up where it stopped, a full ring
ending the level on the "RING FULL / 50%" screen, a 60-coin continue emptying
the ring while keeping the progress, and the balance surviving the trip back to
the map. The win screen and the double-reward ad have not been exercised by
this pass.

Not yet seen with human eyes: the 260ms burst and the near-miss lean (both too
brief to catch by screenshot), a two-chain cascade, and the game-over framing
rotation. Their logic is covered exhaustively by the tests; their _timing_ is
not, and neither is haptic weight. Those are the things to judge on a real
phone.
