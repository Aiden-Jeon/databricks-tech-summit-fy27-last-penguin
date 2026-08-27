# Design — Nimbus Growth Desk

Locked design system. Future Hallmark runs read this file first; pages defer
to it. Amend intentionally — this file is the rule.

## Genre

Modern-minimal: technical, calm, and decision-oriented.

## Macrostructure family

- Marketing pages: Split Studio with restrained proof panels.
- App pages: Workbench with an edge-aligned command header, split decision
  brief, numbered KPI strip, evidence table, and sequential approval rail.
- Content pages: Long Document using the same typography and colour system.

## System

- Genre · modern-minimal
- Macrostructure · Workbench
- Theme · custom (vibe: "cloud light, cool precision, spectral calm")
- Axes · light / geometric-sans / cool
- Navigation · N9 Edge-aligned minimal
- Footer · Ft2 Inline single line
- Enrichment · none on app pages; function carries the interface

## Theme

- `--color-paper` · `oklch(98.4% 0.009 250)`
- `--color-paper-2` · `oklch(96% 0.014 250)`
- `--color-paper-3` · `oklch(92.5% 0.018 250)`
- `--color-ink` · `oklch(20% 0.036 250)`
- `--color-ink-2` · `oklch(34% 0.045 250)`
- `--color-rule` · `oklch(82% 0.025 250)`
- `--color-accent` · `oklch(42% 0.14 250)`
- `--color-focus` · `oklch(58% 0.20 255)`
- Spectral lavender is a quiet secondary tint, never a competing CTA colour.

## Typography

- Display: Space Grotesk, weight 700, roman.
- Body: Geist, weight 400.
- Mono: Geist Mono, weight 500, reserved for IDs and data provenance.
- Display tracking: `-0.035em`.
- Type scale anchor: `--text-display-s = clamp(2.25rem, 5vw, 4rem)`.

## Spacing

Four-point named scale. `tokens.css` is canonical; UI code uses named tokens
instead of raw spacing values when it leaves Tailwind utilities.

## Motion

- Motion-cut with button press feedback and functional loading indicators.
- No section-by-section reveal and no ambient animation.
- Reduced-motion fallback: opacity-only, at most 150 ms.

## Microinteractions stance

- Silent success; visible state changes are their own confirmation.
- Buttons use a one-pixel press shift, instant focus ring, and clear loading copy.
- Error and success states always pair colour with text or an icon.

## CTA voice

- Primary: deep Nimbus navy, compact rectangle, direct action label.
- Secondary: quiet outline or ghost treatment at the same height.
- Labels never wrap and always name the action.

## Per-page allowances

- App pages must not add decorative enrichment.
- Data visualisation may use semantic success, warning, and error hues in
  addition to the Nimbus anchor; these colours never become decorative fills.
- External Databricks branding may retain its official red only inside the
  Databricks mark.

## What pages MUST share

- Nimbus wordmark treatment, accent placement, type pairing, CTA geometry,
  focus ring, and compact rule-driven panel language.
- Pale cloud paper and cool-tinted neutrals from `tokens.css`.

## What pages MAY differ on

- Workbench panel proportions and the order of evidence modules.
- Content density at mobile breakpoints.
- Semantic status hues required to explain real state.

## Exports

### `tokens.css`

`tokens.css` in the app root is the canonical source of truth.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(98.4% 0.009 250);
  --color-paper-2: oklch(96% 0.014 250);
  --color-paper-3: oklch(92.5% 0.018 250);
  --color-ink: oklch(20% 0.036 250);
  --color-ink-2: oklch(34% 0.045 250);
  --color-rule: oklch(82% 0.025 250);
  --color-rule-2: oklch(72% 0.036 250);
  --color-muted: oklch(49% 0.035 250);
  --color-neutral: oklch(41% 0.045 250);
  --color-accent: oklch(42% 0.14 250);
  --color-focus: oklch(58% 0.20 255);

  --font-display: "Space Grotesk", "Geist", ui-sans-serif, sans-serif;
  --font-body: "Geist", ui-sans-serif, sans-serif;
  --font-outlier: "Geist Mono", ui-monospace, monospace;

  --spacing-3xs: 0.125rem;
  --spacing-2xs: 0.25rem;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2.5rem;
  --spacing-2xl: 4rem;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-md: 1.125rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5625rem;
  --text-2xl: 1.953rem;

  --radius-card: 0.625rem;
  --radius-pill: 999px;
  --radius-input: 0.5rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(98.4% 0.009 250)", "$type": "color" },
    "paper-2": { "$value": "oklch(96% 0.014 250)", "$type": "color" },
    "paper-3": { "$value": "oklch(92.5% 0.018 250)", "$type": "color" },
    "ink": { "$value": "oklch(20% 0.036 250)", "$type": "color" },
    "ink-2": { "$value": "oklch(34% 0.045 250)", "$type": "color" },
    "rule": { "$value": "oklch(82% 0.025 250)", "$type": "color" },
    "rule-2": { "$value": "oklch(72% 0.036 250)", "$type": "color" },
    "muted": { "$value": "oklch(49% 0.035 250)", "$type": "color" },
    "neutral": { "$value": "oklch(41% 0.045 250)", "$type": "color" },
    "accent": { "$value": "oklch(42% 0.14 250)", "$type": "color" },
    "focus": { "$value": "oklch(58% 0.20 255)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk, Geist, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "Geist, sans-serif", "$type": "fontFamily" },
    "outlier": { "$value": "Geist Mono, monospace", "$type": "fontFamily" }
  },
  "space": {
    "xs": { "$value": "0.5rem", "$type": "dimension" },
    "sm": { "$value": "0.75rem", "$type": "dimension" },
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" },
    "xl": { "$value": "2.5rem", "$type": "dimension" }
  },
  "duration": {
    "micro": { "$value": "120ms", "$type": "duration" },
    "short": { "$value": "220ms", "$type": "duration" },
    "long": { "$value": "420ms", "$type": "duration" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 98.4% 0.009 250;
  --foreground: 20% 0.036 250;
  --card: 99.2% 0.007 250;
  --card-foreground: 20% 0.036 250;
  --popover: 99.2% 0.007 250;
  --popover-foreground: 20% 0.036 250;
  --primary: 42% 0.14 250;
  --primary-foreground: 98.4% 0.009 250;
  --secondary: 92.5% 0.018 250;
  --secondary-foreground: 34% 0.045 250;
  --muted: 92.5% 0.018 250;
  --muted-foreground: 49% 0.035 250;
  --accent: 91% 0.045 250;
  --accent-foreground: 20% 0.036 250;
  --destructive: 52% 0.16 25;
  --destructive-foreground: 98.4% 0.009 250;
  --border: 82% 0.025 250;
  --input: 82% 0.025 250;
  --ring: 58% 0.20 255;
  --radius: 0.625rem;
}
```
