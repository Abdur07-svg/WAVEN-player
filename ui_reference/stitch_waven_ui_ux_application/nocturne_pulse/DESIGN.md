---
name: Nocturne Pulse
colors:
  surface: '#131318'
  surface-dim: '#131318'
  surface-bright: '#39383e'
  surface-container-lowest: '#0e0e13'
  surface-container-low: '#1b1b20'
  surface-container: '#1f1f24'
  surface-container-high: '#2a292f'
  surface-container-highest: '#35343a'
  on-surface: '#e4e1e9'
  on-surface-variant: '#c5c9ae'
  inverse-surface: '#e4e1e9'
  inverse-on-surface: '#303035'
  outline: '#8f937a'
  outline-variant: '#454934'
  surface-tint: '#b1d500'
  primary: '#ffffff'
  on-primary: '#2a3400'
  primary-container: '#ccf22e'
  on-primary-container: '#596c00'
  inverse-primary: '#536500'
  secondary: '#dbb8ff'
  on-secondary: '#470083'
  secondary-container: '#6807ba'
  on-secondary-container: '#d0a6ff'
  tertiary: '#ffffff'
  on-tertiary: '#302f39'
  tertiary-container: '#e4e1ee'
  on-tertiary-container: '#64636e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ccf22e'
  primary-fixed-dim: '#b1d500'
  on-primary-fixed: '#171e00'
  on-primary-fixed-variant: '#3e4c00'
  secondary-fixed: '#efdbff'
  secondary-fixed-dim: '#dbb8ff'
  on-secondary-fixed: '#2b0052'
  on-secondary-fixed-variant: '#6600b7'
  tertiary-fixed: '#e4e1ee'
  tertiary-fixed-dim: '#c7c5d1'
  on-tertiary-fixed: '#1b1b24'
  on-tertiary-fixed-variant: '#464650'
  background: '#131318'
  on-background: '#e4e1e9'
  surface-variant: '#35343a'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.25rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system embodies dark luxury with an electric underground pulse. Designed for modern audiophiles, creative tastemakers, and discerning listeners, it combines midnight sophistication with high-octane digital energy.

The aesthetic philosophy fuses three core movements:
- **Dark Luxury Minimalism:** Deep matte pitch backgrounds that eliminate visual noise, letting high-fidelity album art and metadata command attention.
- **Glassmorphic Tactility:** Subtle, dark-tinted frosted glass planes that hover effortlessly over atmospheric ambient gradients.
- **High-Voltage Contrast:** Striking neon citron and electric lime accents paired with dreamy violet-purple glows, creating depth reminiscent of late-night studio sessions and subterranean listening clubs.

The interface should feel tactile, fluid, deeply immersive, and premium—eschewing flat utilitarianism in favor of organic lighting and responsive tactile controls.

## Colors

The palette is engineered around high luminance contrast against an ultra-deep canvas:

- **Canvas & Surface Base (`#0D0D12`):** A custom matte obsidian base that provides an infinite depth foundation without harsh OLED pitch-black banding.
- **Primary Accent (`#D2F835`):** An electric citron lime that delivers unmistakable visual punch. Reserved strictly for active states, playback execution, hero indicators, and primary CTAs. Text set against this color must always be near-black (`#0D0D12`).
- **Atmospheric Glow & Secondary Accent (`#7928CA` to `#B87BFF`):** Ambient violet gradients that bloom gently beneath featured content carousels, hero backdrops, and active media cards, establishing spatial depth.
- **Surface Elevation Containers (`#16161F`, `#1F1F28`, `#282836`):** Low-contrast matte slate containers that separate content tiers cleanly without the need for stark borders.
- **Content Hierarchy Text:**
  - High-Emphasis: `#FFFFFF` (100% white)
  - Medium-Emphasis: `rgba(255, 255, 255, 0.70)`
  - Subdued / Metadata: `rgba(255, 255, 255, 0.45)`

## Typography

The typographic hierarchy pairs the soft, modern curves of **Plus Jakarta Sans** for prominent headlines and interactive navigational labels with the utilitarian clarity of **Inter** for dense metadata, tracklists, lyrics, and descriptions.

- **Headlines:** Use high letter-spacing precision (`-0.02em` on titles) to reinforce the premium, contemporary editorial atmosphere.
- **Numerics & Timestamps:** Track durations, play counts, and audio timestamps utilize tabular sizing flags where available to prevent jitter during real-time playback updates.
- **Labels & Chips:** Rendered in medium to semi-bold weights for rapid legibility against dark translucent pills.

## Layout & Spacing

The layout is built around a dynamic fluid grid system optimized for thumb-driven mobile interaction and spacious desktop dashboards:

- **Mobile (< 768px):** Single-column layout with 4-column subgrids, `1.25rem` screen margins, and a pinned bottom floating glass dock with safe-area spacing padding (`space-xl` bottom buffer).
- **Tablet & Desktop (≥ 768px):** Reflows into an 8 to 12-column fluid grid, expanding margins to `2.5rem`, shifting secondary panels (player queues, lyrics) into dedicated side rails while the floating bar translates into an expanded bottom transport or docked sidebar.
- **Horizontal Swiping Rails:** Feature cards and category filters break the outer grid margin softly with peek-ahead bleeding, signaling scrollable overflow.

## Elevation & Depth

Spatial hierarchy is expressed through a marriage of dark translucent glass, layered tonal containers, and tinted atmospheric blooms:

- **Base Level (Canvas):** Pure `#0D0D12` matte plane.
- **Level 1 (Cards & Rows):** Filled with solid `#16161F` or soft vertical gradients (`linear-gradient(180deg, #1C1C26 0%, #14141B 100%)`). Borders are hairline ghost outlines: `1px solid rgba(255, 255, 255, 0.07)`.
- **Level 2 (Featured Hero Cards):** Emits an organic radial ambient glow (`box-shadow: 0 20px 40px -15px rgba(121, 40, 202, 0.35)`), creating an illuminated halo around artwork.
- **Level 3 (Floating Controls & Navigation):** The bottom bar and interactive modal overlays employ frosted glass:
  - Background: `rgba(28, 28, 38, 0.65)`
  - Backdrop Filter: `blur(24px) saturate(180%)`
  - Border: `1px solid rgba(255, 255, 255, 0.12)`
  - Shadow: `0 16px 36px rgba(0, 0, 0, 0.6)`

## Shapes

The design system embraces a high-radius curve philosophy that balances comfort with futuristic luxury:

- **Pills (`roundedness: 3`):** Category filter chips, interactive primary action buttons, search fields, floating navigation bars, and tag badges utilize full capsule geometry.
- **Hero & Content Cards (`rounded-lg` to `rounded-xl`):** Playlist covers, curated banner cards, and media modules employ generous radii ranging from `1.5rem` to `2rem`, framing edge-to-edge photography with elegant softness.
- **Media Artwork & Thumbnails:** Track row avatars and small album squares use smooth `0.75rem` to `1rem` squircle profiles, avoiding harsh right angles across all screen scales.

## Components

### Buttons & Quick Actions
- **Primary CTA / Active Pill:** Filled with `#D2F835`, labeled with `#0D0D12` bold typography. When pressed, applies a subtle scale-down (`0.96`).
- **Ghost / Inactive Filter Chips:** Styled with translucent dark surfacing (`rgba(255, 255, 255, 0.08)`), white text at 70% opacity, and no stroke. Transitions to active state via smooth color interpolation.
- **Circular Icon Controls:** Play/pause buttons inside cards utilize high-contrast colored discs (`#D2F835` or deep violet `#3A1363`) with sharp vector glyphs centered inside. Secondary icon controls (like, download, more) use ghost states with low-opacity icon fills.

### Navigation Dock (Floating Bar)
- Suspended `1.25rem` above the bottom safe area with pill geometry.
- Built using dark frosted glass (`rgba(28, 28, 38, 0.70)` with `blur(24px)`).
- Active navigation item features a vivid neon lime circular tab container (`#D2F835` with dark icon), while unselected icons rest at `rgba(255, 255, 255, 0.45)` with soft hover brightening.

### Cards & Media Modules
- **Hero Featured Card:** Accommodates high-contrast photography cropped on the right, blended into a rich violet gradient background on the left. Holds the card headline, subtitle description, and inline playback controls with minimal visual friction.
- **Track List Items:** Minimal horizontal layouts with album thumbnail on the left, primary track title in high-emphasis white, secondary artist name separated by dot separators, and an ambient hover/tap play button on the right.

### Input Fields & Search
- Completely enclosed pill containers with subtle dark fills (`#1A1A24`), recessed padding, soft neon cursor caret, and clear accessory icons.
- Focused state transitions border from `rgba(255, 255, 255, 0.08)` to `rgba(210, 248, 53, 0.5)`.

### Mini Player & Scrubber
- Compact floating capsule that snaps immediately above the glass navigation bar when an active session is playing.
- Progress scrubbers display ultra-thin track lines (`2px`) with the elapsed portion highlighted in electric citron lime `#D2F835`.