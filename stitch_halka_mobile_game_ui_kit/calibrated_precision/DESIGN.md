---
name: Calibrated Precision
colors:
  surface: '#111319'
  surface-dim: '#111319'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#191c21'
  surface-container: '#1d2025'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e1e2ea'
  on-surface-variant: '#ccc3d2'
  inverse-surface: '#e1e2ea'
  inverse-on-surface: '#2e3036'
  outline: '#958e9c'
  outline-variant: '#4a4551'
  surface-tint: '#d4bbff'
  primary: '#d4bbff'
  on-primary: '#3e1975'
  primary-container: '#b794f4'
  on-primary-container: '#492680'
  inverse-primary: '#6d4ca6'
  secondary: '#5adace'
  on-secondary: '#003733'
  secondary-container: '#01a89d'
  on-secondary-container: '#003531'
  tertiary: '#ffb866'
  on-tertiary: '#482900'
  tertiary-container: '#dc9741'
  on-tertiary-container: '#573300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ebdcff'
  primary-fixed-dim: '#d4bbff'
  on-primary-fixed: '#270058'
  on-primary-fixed-variant: '#55338d'
  secondary-fixed: '#79f7ea'
  secondary-fixed-dim: '#5adace'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#00504a'
  tertiary-fixed: '#ffddba'
  tertiary-fixed-dim: '#ffb866'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#111319'
  on-background: '#e1e2ea'
  surface-variant: '#32353b'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '300'
    lineHeight: 52px
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '300'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.14em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.18em
  telemetry-num:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '300'
    lineHeight: 36px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.5rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system approaches the spatial ring puzzle experience not as a conventional playful casual toy, but as a calibrated scientific apparatus. Designed for focused problem-solvers, engineers, and minimalist aesthetic purists, the interface evokes the quiet tension of an optical laboratory bench or an aerospace diagnostic instrument in a dark room.

The aesthetic philosophy centers on:
- **Quiet Telemetry:** Flat, razor-thin structural framing, generous negative voids, and complete absence of decorative drop shadows, skeuomorphic volume, or gradients.
- **Instrument Precision:** Interaction targets, status readings, and geometric puzzles operate under zero-friction mechanics. Every line is intentional; every indicator has functional purpose.
- **Ergonomic Partitioning:** Critical interactive controls reside within the bottom 40% thumb zone, allowing the upper 60% viewport to serve as an unpolluted observation chamber for the primary rings and prisms.

## Colors

The palette is tuned for high-contrast optical clarity against an ultra-deep void:
- **Base Canvas (`#0B0E13`):** An absorbing, near-black slate that eliminates visual distractions and minimizes ambient light glare.
- **Structural Surfaces (`#141A23`):** Technical surface tone for nested trays, instrumentation HUDs, and modular dialogs.
- **Structural Lines (`#1F2937`):** Hairline borders (1px to 1.5px) defining boundaries without adding visual weight.
- **Text & Telemetry:** `#E6EDF5` (High-visibility optical white for primary data and active indicators) alongside `#61728A` (Damped secondary slate for units, structural grids, and passive labels).
- **Resonant Puzzle Entities:**
  - **Violet Ring (`#B794F4`):** Primary system resonant frequency and primary action states.
  - **Teal Ring (`#4FD1C5`):** Secondary balanced vector; harmonic connection state.
  - **Amber Ring / Urgent Metric (`#F6AD55`):** Dynamic tension, critical turns remaining, and warnings.
  - **Prism Piece (`#F2F7FC`):** Pure optical focal point, executed as a hollow high-luminescence ring structure.

## Typography

The typographic hierarchy juxtaposes the wide, angular geometry of `Space Grotesk` with the rigid tabular cadence of `JetBrains Mono`.

- **Numerical Readouts:** Large numerical readouts (move counts, degree rotations, phase timers) use light weights (`300`) to convey delicate precision rather than blunt force.
- **Labels & Metrology:** All metadata and micro-labels utilize `JetBrains Mono` rendered strictly in uppercase with heavy tracking (`0.14em` to `0.18em`).
- **Tabular Rigidity:** Numbers remain monospaced or set to tabular figures to ensure layout zero-jitter during rapid state updates or rotation recalculations.

## Layout & Spacing

The viewport implements a fixed vertical split built around tactile human ergonomics:
- **Upper Sector (Observation & Puzzle Rig, 60vh):** Centered spatial ring mechanism framed with generous empty margins (`space-xl`). Elements maintain wide breathing margins to avoid sensory overload during alignment tasks.
- **Lower Sector (Interaction Deck, 40vh):** Clustered strictly within one-handed thumb arcs. Contains rotational dials, inventory slots, reset cycles, and step trackers.

The layout coordinates along a 4-column mobile grid using `1.25rem` screen margins and `1rem` internal gutters. Padding scales in exact multiples of 4px/8px to preserve spatial telemetry alignment.

## Elevation & Depth

This system discards conventional drop shadows, colored ambient glows, and skeuomorphic bevels in favor of **planar structural zoning**:
- **Layer 0 (Void):** Absolute background `#0B0E13`.
- **Layer 1 (Substrate & Trays):** `#141A23` defined strictly by a 1px border of `#1F2937`.
- **Layer 2 (Active Reticles & Interactive Pills):** Border shifts from `#1F2937` to dynamic semantic states (`#B794F4` or `#4FD1C5`) with zero drop shadow. Focus is communicated purely through 1.5px high-contrast hairline outlines.
- **Overlays & Modals:** Flat `#141A23` plates bordered with `#1F2937` hovering over a 70% opacity `#0B0E13` dimming scrim without blur.

## Shapes

The primary structural geometry favors technical precision:
- **Panels, Dialogs, and Inspection Tiles:** Grounded using base `0.5rem` (`rounded-md`) corners to maintain an architectural, instrument-like silhouette.
- **Controls & Buttons:** Explicitly pill-shaped (`9999px`) to create an intuitive semantic division between structural framing (cards/telemetry modules) and direct physical inputs (actions/dials).
- **Puzzle Elements:** Strict concentric circles and geometric rings with vector-sharp outer edges and hollow negative centers.

## Components

### Buttons & Triggers
- **Pill Outline Action:** 1px border using `#1F2937` over transparent or `#141A23` fills. Text uses `label-lg` in `#E6EDF5`. On active press, the border instantly snaps to `#B794F4` with the label tinting `#B794F4`.
- **Urgent Action / Reset:** 1px border tinted with `#F6AD55` and matching `#F6AD55` monospaced tracked text.

### Telemetry Cards & Metric Cells
- Enclosed modules with `#141A23` fill, sharp 1px `#1F2937` borders, and `space-md` internal padding.
- Upper region contains tracked micro-label (`label-sm`, `#61728A`); main body displays tabular readout (`telemetry-num`, `#E6EDF5`).

### Alignment Chips & Phase Indicators
- Monospaced, all-caps status tags encased in 1px pill containers with `space-xs` vertical and `space-sm` horizontal padding.
- Inactive state: `#61728A` text and `#1F2937` border. Active phase: `#4FD1C5` border and text.

### Reticle Selectors & Ring Holders
- Square aspect ratio tiles (`0.5rem` corner radius) acting as bottom-tray inventory slots.
- Active slot highlighted via 1.5px `#B794F4` outline.
- Empty states feature a single central crosshair plotted in `#1F2937`.

### The Hollow Prism Indicator
- Represented as a segmented dual-ring glyph with a completely transparent hollow core, bordered with 1.5px `#F2F7FC`.