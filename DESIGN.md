# GoShipping — Brand & UI Design System Specification

Official design guidelines for public marketing, customer portal, and operations dashboards.

---

## 1. Logo & Brand Assets

- **Light Background**: Red Go mark + Midnight Ink (`#11181E`) lettering: [`public/brand/logo-light.svg`](file:///Users/jitkumarsaha/Projects/Goshipping/public/brand/logo-light.svg).
- **Dark Background**: Red Go mark + White (`#FFFFFF`) lettering: [`public/brand/logo-dark.svg`](file:///Users/jitkumarsaha/Projects/Goshipping/public/brand/logo-dark.svg).
- **Favicon / App Icon**: Red Go mark with forward motion chevron: [`public/brand/favicon.svg`](file:///Users/jitkumarsaha/Projects/Goshipping/public/brand/favicon.svg).
- **Logo Integrity**: Shape, cutting, letterforms, and proportions must remain unaltered. No auto-tracing or artificial distortion.

---

## 2. Color Palette & Semantic Tokens

All UI colors must route through design tokens in [`src/styles/tokens.css`](file:///Users/jitkumarsaha/Projects/Goshipping/src/styles/tokens.css).

| Token Name | Hex Code | Purpose & Application |
|---|---|---|
| `--color-brand-primary` | `#EA1D2C` | Primary CTA, active progress markers, brand highlight |
| `--color-brand-primary-hover` | `#D41523` | Interactive hover state for primary buttons |
| `--color-brand-primary-subtle` | `#F8E9EB` | Soft Red Surface for active pills, hover tabs, badges |
| `--color-midnight` | `#11181E` | High-contrast headings, dark hero backgrounds, dark footer |
| `--color-canvas` | `#FFFFFF` | Default light mode main application background |
| `--color-success` | `#10B981` | Delivered status, positive confirmations, operational health |
| `--color-warning` | `#F59E0B` | In-review quotes, pending customs clearance notices |
| `--color-error` | `#EA1D2C` | Critical errors, operational exceptions, cancellations |

### Dark Mode Tokens
Dashboard supports dark mode (`[data-theme="dark"]`):
- `--color-canvas`: `#0B1015`
- `--color-surface-subtle`: `#11181E`
- `--color-surface-muted`: `#19232B`
- `--color-border-subtle`: `#24303B`

---

## 3. Typography Hierarchy

| Application | Font Family | Weight | Direction |
|---|---|---|---|
| **Hero Headings** | `Manrope` | 800 (ExtraBold) | Tight letter-spacing (`-0.03em`), high impact |
| **Section Headings** | `Manrope` | 700 (Bold) | Clean sentence-case or title-case |
| **Body & Navigation** | `Manrope` | 500 / 600 (Medium) | 14px–16px content text, 1.6 line height |
| **Dashboard & Tables** | `Inter` | 400 / 500 / 600 | Clear data density, optical alignment |
| **Tracking Codes & Numbers** | `Inter` / `font-mono` | 600 / 700 | `tabular-nums`, uppercase monospace |
| **Bengali Content** | `Noto Sans Bengali` | 400 / 600 / 700 | Hotline notices and localized help |

---

## 4. Cloudflare Kumo UI Integration Strategy

- **Semantic Token Overrides**: Map Kumo UI variables to GoShipping Red (`--kumo-accent: #EA1D2C`). Replace default orange accent with centralized spacing, radius, and focus rings.
- **Used Components**:
  - `Kumo Sidebar` & Navigation
  - `Kumo Table` (tabular numbers for weights, pieces, currencies)
  - `Kumo Tabs` (Overview, Shipments, Quotes, Documents, Warehouses)
  - `Kumo Badge` (Status pills with high-contrast text)
  - `Kumo Dialog` / Modal (controlled `open={open}`, itemized quote breakdowns)
- **Zero Card Nesting**: Never nest cards inside cards. Use clean flat borders (`border border-slate-200`) and subtle background elevations.

---

## 5. Anti-AI-Slop & Quality Floor Invariants

1. **Tokens Over Literals**: No raw literal colors or ad-hoc fonts outside `:root` tokens.
2. **Animation Discipline**: Never use `transition: all`. Never animate `width`, `height`, `top`, or `left`. Always provide `@media (prefers-reduced-motion: reduce)` fallbacks.
3. **Typography Integrity**: No tracked uppercase labels (`tracking-widest` on small text), no italics inside roman headings, no fake browser chrome mockups.
4. **Layout**: Always enforce `overflow-x: clip` on `html` and `body` (never `hidden`, never `100vw`).
5. **Above-the-Fold Viewport**: At 1280×800 viewport, the primary headline, value statement, and primary CTA action must be fully visible without scrolling.
