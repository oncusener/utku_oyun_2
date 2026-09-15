/**
 * engine.ts — the whole game, as pure functions.
 *
 * No React, no React Native, no Reanimated, no clocks, no randomness. Every
 * function here is deterministic and synchronous so engine.test.ts can pin the
 * rules down without booting a renderer. Game.tsx owns time and pixels; this
 * file owns truth.
 */

export const SLOTS = 6;

export type Color = 0 | 1 | 2;
export type ColorPiece = { color: Color };
export type PrismPiece = { prism: true };
export type Piece = ColorPiece | PrismPiece;
export type Slot = Piece | null;
export type Board = Slot[];

export function isPrism(p: Piece): p is PrismPiece {
  return (p as PrismPiece).prism === true;
}

/** Positive modulo. The ring is circular; every index calculation goes through this. */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function emptyBoard(): Board {
  return [null, null, null, null, null, null];
}

export function cloneBoard(b: Board): Board {
  return b.slice();
}

/* ------------------------------------------------------------------ *
 * Rotation
 * ------------------------------------------------------------------ */

/**
 * The anchor is nailed to 12 o'clock. Slot `i` is drawn at angle
 * `(i + offset) * 60deg` from the top, so the slot sitting under the anchor is
 * the one where that angle is zero.
 */
export function anchorIndex(offset: number): number {
  return mod(-offset, SLOTS);
}

/**
 * The drag is tracked as an unwrapped step count so the ring never spins the
 * long way round when it crosses the 5 -> 0 seam. Logic wants it wrapped.
 */
export function offsetFromSteps(steps: number): number {
  return mod(Math.round(steps), SLOTS);
}

/** Shortest unwrapped step count that lands on `targetOffset`. */
export function nearestSteps(currentSteps: number, targetOffset: number): number {
  const base = Math.round(currentSteps);
  const delta = mod(targetOffset - base, SLOTS);
  return base + (delta <= SLOTS / 2 ? delta : delta - SLOTS);
}

/* ------------------------------------------------------------------ *
 * Colour compatibility
 * ------------------------------------------------------------------ */

/** The colour a slot insists on, or null for a prism (matches anything) / empty. */
export function pieceColor(s: Slot): Color | null {
  if (s === null || isPrism(s)) return null;
  return s.color;
}

/** Can this slot take part in a run of `color`? */
export function compatible(s: Slot, color: Color): boolean {
  return s !== null && (isPrism(s) || s.color === color);
}

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

/** A contiguous, circular stretch of the ring that clears as one merge. */
export type Run = { start: number; len: number; color: Color | null };

/**
 * The colour a span agrees on, or null if the span cannot merge.
 * A span of nothing but prisms agrees vacuously and reports colour `null`.
 */
function spanColor(
  board: Board,
  start: number,
  len: number,
): { color: Color | null } | null {
  let color: Color | null = null;
  for (let k = 0; k < len; k++) {
    const s = board[mod(start + k, SLOTS)];
    if (s === null) return null;
    if (isPrism(s)) continue;
    if (color === null) color = s.color;
    else if (color !== s.color) return null;
  }
  return { color };
}

/**
 * One run per call, longest first.
 *
 * Deliberately *not* "every run at once": clearing a single run and letting the
 * collapse re-check is what makes cascades exist at all. On a six-slot ring the
 * complement of a cleared run is itself contiguous, so a board like
 * [B,B,B,A,A,A] only chains if BBB goes first and AAA is rediscovered after the
 * survivors slide together.
 *
 * Ties break to the lowest start index, which keeps resolve() deterministic.
 */
export function findMatch(board: Board): Run | null {
  for (let len = SLOTS; len >= 3; len--) {
    for (let start = 0; start < SLOTS; start++) {
      const hit = spanColor(board, start, len);
      if (hit) return { start, len, color: hit.color };
      // Every rotation of a full-ring span is the same span.
      if (len === SLOTS) break;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Collapse
 * ------------------------------------------------------------------ */

/**
 * A run this long or longer leaves a prism behind when it clears.
 *
 * This is the game's only real reward, and it exists for two reasons.
 *
 * A four-run cannot be assembled gradually — the moment three of a colour touch
 * they merge — so the only way to make one is to leave a deliberate gap between
 * a pair and a single and then fill it. That is the one genuinely skilful thing
 * the ring asks of you, and before this it paid exactly the same as a lazy three.
 *
 * It is also what makes cascades reachable at all. A chain needs a collapse to
 * reveal a second run, which on six slots means the survivors must already share
 * a colour — a configuration legal play can never build, because the earlier
 * triple would have merged first. A prism is a wildcard, so it can complete a
 * run with any two survivors that happen to be adjacent.
 */
export const PRISM_RUN_LENGTH = 4;

export type Collapse = {
  board: Board;
  /** travel[newIndex] = how many 60deg steps counter-clockwise that piece slid. */
  travel: number[];
  /** Slot where a prism condensed out of a long run, or -1. */
  residue: number;
};

/**
 * Survivors fall counter-clockwise into the hole the run left behind.
 *
 * Walking clockwise from the far edge of the cleared run, each surviving piece
 * is packed against the run's counter-clockwise-most slot. Pre-existing gaps
 * further round the ring get swallowed on the way, because a piece slides until
 * something stops it — that is what makes the board churn instead of ossifying.
 *
 * `travel` is handed to the renderer so each piece can be drawn at the angle it
 * came from and eased home; every entry is >= 0, i.e. nothing ever moves clockwise.
 */
export function collapse(board: Board, run: Run): Collapse {
  const out = emptyBoard();
  const travel = [0, 0, 0, 0, 0, 0];
  const g = mod(run.start, SLOTS);
  let write = g;
  let residue = -1;

  // A long run condenses rather than simply vanishing. The prism takes the
  // counter-clockwise end of the hole and the survivors pack in behind it.
  if (run.len >= PRISM_RUN_LENGTH) {
    out[g] = { prism: true };
    residue = g;
    write = mod(g + 1, SLOTS);
  }

  for (let d = run.len; d < SLOTS; d++) {
    const from = mod(g + d, SLOTS);
    const piece = board[from];
    if (piece === null) continue;
    const to = mod(write, SLOTS);
    out[to] = piece;
    travel[to] = mod(from - to, SLOTS);
    write = mod(write + 1, SLOTS);
  }

  return { board: out, travel, residue };
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

export type ResolveStep = {
  run: Run;
  /** Absolute slot indices that burst, for the clear mask. */
  indices: number[];
  boardAfter: Board;
  travel: number[];
  /** Slot where a prism condensed out of this run, or -1. */
  residue: number;
};

export type ResolveResult = {
  board: Board;
  steps: ResolveStep[];
  chain: number;
  scoreGained: number;
};

/** Triangular: one merge is worth 1, a two-chain 3, a three-chain 6. */
export function chainScore(chain: number): number {
  return chain === 0 ? 0 : (chain * (chain + 1)) / 2;
}

export function resolve(board: Board): ResolveResult {
  let cur = cloneBoard(board);
  const steps: ResolveStep[] = [];

  // Each pass removes at least three pieces from a six-slot ring, so this can
  // run at most twice — but the loop is written to terminate on its own terms.
  for (;;) {
    const run = findMatch(cur);
    if (!run) break;
    const indices: number[] = [];
    for (let k = 0; k < run.len; k++) indices.push(mod(run.start + k, SLOTS));
    const next = collapse(cur, run);
    steps.push({
      run,
      indices,
      boardAfter: next.board,
      travel: next.travel,
      residue: next.residue,
    });
    cur = next.board;
  }

  return {
    board: cur,
    steps,
    chain: steps.length,
    scoreGained: chainScore(steps.length),
  };
}

/* ------------------------------------------------------------------ *
 * Dropping
 * ------------------------------------------------------------------ */

export type DropResult =
  { ok: true; board: Board; index: number } | { ok: false; index: number };

export function canDrop(board: Board, offset: number): boolean {
  return board[anchorIndex(offset)] === null;
}

/** No empty slot anywhere: every rotation is a losing drop. */
export function isBoardFull(board: Board): boolean {
  return board.every((s) => s !== null);
}

export function applyDrop(board: Board, offset: number, piece: Piece): DropResult {
  const index = anchorIndex(offset);
  if (board[index] !== null) return { ok: false, index };
  const next = cloneBoard(board);
  next[index] = piece;
  return { ok: true, board: next, index };
}

/* ------------------------------------------------------------------ *
 * Reading the board, for the bag
 * ------------------------------------------------------------------ */

/** Is there an empty slot where this piece would merge right now? */
export function completesRun(board: Board, piece: Piece): boolean {
  for (let i = 0; i < SLOTS; i++) {
    if (board[i] !== null) continue;
    const test = cloneBoard(board);
    test[i] = piece;
    if (findMatch(test) !== null) return true;
  }
  return false;
}

/** Is this colour on the board at all, with somewhere to grow? */
export function hasColor(board: Board, color: Color): boolean {
  for (let i = 0; i < SLOTS; i++) {
    if (!compatible(board[i], color)) continue;
    if (board[mod(i - 1, SLOTS)] === null || board[mod(i + 1, SLOTS)] === null) return true;
  }
  return false;
}

/** An adjacent pair of this colour with at least one open end to grow into. */
export function hasLivePair(board: Board, color: Color): boolean {
  for (let a = 0; a < SLOTS; a++) {
    const b = mod(a + 1, SLOTS);
    if (!compatible(board[a], color) || !compatible(board[b], color)) continue;
    if (board[mod(a - 1, SLOTS)] === null || board[mod(b + 1, SLOTS)] === null) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Near miss
 * ------------------------------------------------------------------ */

export type NearMiss = { a: number; b: number; third: number; color: Color };

/**
 * Exactly two adjacent slots of one colour, with a third of that colour sitting
 * one slot out from either end. On a six-ring the two "one slot away" positions
 * are a+3 and a+4 — the only slots that are neither in the pair nor touching it.
 */
export function findNearMiss(board: Board): NearMiss | null {
  for (let a = 0; a < SLOTS; a++) {
    const b = mod(a + 1, SLOTS);
    const sa = board[a];
    const sb = board[b];
    if (sa === null || sb === null) continue;

    // Two prisms have no colour to be tantalised by.
    const color = pieceColor(sa) ?? pieceColor(sb);
    if (color === null) continue;
    if (!compatible(sa, color) || !compatible(sb, color)) continue;

    // "Exactly two": neither outward neighbour may extend the run. (After a
    // resolve nothing longer can survive, but near-miss is also called on
    // boards mid-flight, so the check earns its keep.)
    if (compatible(board[mod(a - 1, SLOTS)], color)) continue;
    if (compatible(board[mod(b + 1, SLOTS)], color)) continue;

    for (const third of [mod(a - 2, SLOTS), mod(b + 2, SLOTS)]) {
      if (compatible(board[third], color)) return { a, b, third, color };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Endgame framing
 * ------------------------------------------------------------------ */

/** Any adjacent compatible pair, regardless of what else is on the board. */
export function findAdjacentPair(board: Board): { a: number; b: number } | null {
  for (let a = 0; a < SLOTS; a++) {
    const b = mod(a + 1, SLOTS);
    const sa = board[a];
    const sb = board[b];
    if (sa === null || sb === null) continue;
    const color = pieceColor(sa) ?? pieceColor(sb);
    if (color === null) return { a, b }; // two prisms: still a pair
    if (compatible(sa, color) && compatible(sb, color)) return { a, b };
  }
  return null;
}

/** The two compatible pieces with the smallest circular gap between them. */
export function findClosestPair(
  board: Board,
): { a: number; b: number; gap: number } | null {
  let best: { a: number; b: number; gap: number } | null = null;
  for (let i = 0; i < SLOTS; i++) {
    const si = board[i];
    if (si === null) continue;
    for (let d = 1; d < SLOTS; d++) {
      const j = mod(i + d, SLOTS);
      const sj = board[j];
      if (sj === null) continue;
      const color = pieceColor(si) ?? pieceColor(sj);
      const ok = color === null || (compatible(si, color) && compatible(sj, color));
      if (!ok) continue;
      const gap = Math.min(d, SLOTS - d);
      if (best === null || gap < best.gap) best = { a: i, b: j, gap };
    }
  }
  return best;
}

/**
 * The Zeigarnik hook: leave the player looking at something unfinished.
 *
 * Note what rotation can and cannot do. Adjacency lives in the board indices,
 * and the board is frozen the instant a drop lands on an occupied slot — so no
 * offset can *create* a neighbouring pair, and piece identities are never
 * touched. What the offset controls is *where on the dial* the board's most
 * complete run sits. We park it under the anchor at 12 o'clock, the one place
 * the eye is already trained to look, so the last thing on screen is an
 * almost-merge rather than an arbitrary slice of the ring.
 *
 * Preference order: a near-miss pair (two together plus a third in reach), then
 * any adjacent pair, then the two closest same-colour pieces.
 */
export function zeigarnikOffset(board: Board, currentOffset: number): number {
  const nm = findNearMiss(board);
  if (nm) return mod(-nm.a, SLOTS);

  const pair = findAdjacentPair(board);
  if (pair) return mod(-pair.a, SLOTS);

  const close = findClosestPair(board);
  if (close) return mod(-close.a, SLOTS);

  return mod(currentOffset, SLOTS);
}

/* ------------------------------------------------------------------ *
 * Render mirror
 * ------------------------------------------------------------------ */

/**
 * The renderer keeps the board in a Reanimated shared value so board changes
 * and animation changes land on the UI thread in the same batch — no React
 * commit can slip between a collapse and the slide that animates it. Shared
 * values want plain numbers, so pieces are flattened to codes.
 */
export const CODE_EMPTY = -1;
export const CODE_PRISM = 3;

export function encodeSlot(s: Slot): number {
  if (s === null) return CODE_EMPTY;
  return isPrism(s) ? CODE_PRISM : s.color;
}

export function decodeSlot(code: number): Slot {
  if (code === CODE_EMPTY) return null;
  if (code === CODE_PRISM) return { prism: true };
  return { color: code as Color };
}

export function encodeBoard(b: Board): number[] {
  return b.map(encodeSlot);
}

/** Bitmask of slot indices, for cheap membership tests inside worklets. */
export function maskOf(indices: number[]): number {
  let m = 0;
  for (const i of indices) m |= 1 << i;
  return m;
}
