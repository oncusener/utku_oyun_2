/**
 * theme.ts — every colour and dimension in one place.
 *
 * Dark by default: the game is played in a lit carriage at night, held close,
 * often one-handed. A bright field of white is the wrong thing to point at
 * someone's face on the last train home.
 *
 * The three piece colours are separated by lightness as well as hue, so they
 * stay distinguishable under deuteranopia and behind a cracked screen protector.
 */

export const palette = {
  bg: '#0B0E13',
  glow: '#141B26',

  ringTrack: '#19212C',
  slotEmpty: '#141A23',
  slotEmptyRim: '#1F2937',

  anchor: '#46586B',
  anchorTarget: '#2A3646',

  settleCalm: '#3C5A70',
  settleUrgent: '#F6AD55',

  text: '#E6EDF5',
  textDim: '#61728A',
} as const;

/** Indexed by piece colour 0 | 1 | 2. */
export const pieceColors = ['#4FD1C5', '#F6AD55', '#B794F4'] as const;

export const prismColor = '#F2F7FC';
export const prismRim = '#8FA6BD';

/**
 * Lookup used inside worklets: index by the codes from engine.ts
 * (0 | 1 | 2 = colours, 3 = prism). Plain strings so a worklet can index it
 * without allocating.
 */
export const codeColors: string[] = [...pieceColors, prismColor];

export const geometry = {
  /** Horizontal drag needed to advance one 60deg step. */
  pxPerStep: 48,
  /** Ring radius as a fraction of the shorter screen axis, then clamped. */
  ringFraction: 0.33,
  ringMax: 140,
  /** Piece radius as a fraction of the ring radius. */
  pieceFraction: 0.26,
  pieceMin: 16,
  pieceMax: 34,
  /** Next piece: radius as a fraction of a board piece, and how far below centre. */
  nextFraction: 0.52,
  nextGap: 12,
  /**
   * Opacity is the wrong lever for de-emphasising the next piece on a near-black
   * field: at 0.4 every colour blends toward the background and the hue dies —
   * amber reads as mud, teal as dull green, and the preview stops answering the
   * one question it exists to answer. Hierarchy comes from size instead (it is
   * half the radius of the active piece); this only takes the edge off.
   */
  nextOpacity: 0.85,
  /** How far the settle arc sits outside the centre piece. */
  arcGap: 13,
  arcWidth: 3,
  /** Vertical centre of the ring, as a fraction of screen height. */
  ringCenterY: 0.54,
} as const;

export const type = {
  score: { fontSize: 64, letterSpacing: -2 },
  label: { fontSize: 13, letterSpacing: 3 },
  hint: { fontSize: 14, letterSpacing: 1 },
} as const;
