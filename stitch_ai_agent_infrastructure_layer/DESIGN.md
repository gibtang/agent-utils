---
name: AgentUtils Core
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#7000ff'
  on-secondary-container: '#ddcdff'
  tertiary: '#f5f5f5'
  on-tertiary: '#2f3131'
  tertiary-container: '#d9d9d9'
  on-tertiary-container: '#5d5f5f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#23005b'
  on-secondary-fixed-variant: '#5700c9'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
  space-black: '#050505'
  charcoal-gray: '#121214'
  border-subtle: '#262629'
  syntax-comment: '#6272A4'
  syntax-keyword: '#FF79C6'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  stack-unit: 8px
---

## Brand & Style

The design system is engineered for **technical reliability and developer confidence**. It positions itself as the "industrial-grade" infrastructure layer for AI agents—where safety, recovery, and human-in-the-loop oversight are non-negotiable.

The visual style is a sophisticated blend of **Minimalism** and **Technical Corporate**. It draws inspiration from high-end developer tools and fintech infrastructure (like Stripe), utilizing a "dark-first" philosophy to reduce eye strain during long engineering sessions. The aesthetic is defined by high-contrast typography, precise borders, and a disciplined use of accent colors to denote "primitives" and system status.

The emotional response should be one of **absolute stability**. By using deep blacks, sharp lines, and spacious layouts, the UI feels like a clean, well-documented terminal—purpose-built for mission-critical operations.

## Colors

The palette is optimized for a **high-contrast dark mode** environment. 

- **Primary (Electric Cyan):** Used sparingly for "active" primitives, primary call-to-actions, and success states. It represents the flow of data and energy.
- **Secondary (Neon Purple):** Used for advanced infrastructure concepts like DLQs and human-in-the-loop triggers.
- **Backgrounds:** We utilize a tiered black approach. `#050505` for the base canvas and `#121214` for elevated surfaces like cards and code blocks.
- **Borders:** Instead of heavy shadows, depth is created with a crisp `#262629` border.
- **Typography:** Primary text is pure white (`#FFFFFF`) or high-clarity gray (`#A1A1AA`) to ensure maximum legibility against the dark void.

## Typography

The typography system prioritizes **technical precision**. 

**Geist** is the primary typeface for the UI, chosen for its ultra-modern, geometric clarity and optimized rendering on high-resolution displays. It provides the "Stripe-like" premium feel.

**JetBrains Mono** is utilized for all technical primitives, including code snippets, API endpoints, and system labels. This distinction helps developers mentally separate "Management UI" from "Infrastructure Output."

- **Headlines:** Large, bold, and tightly tracked to create a sense of impact.
- **Labels:** Always Monospaced and often uppercase when used for metadata (e.g., `POST`, `DLQ_RETRY`).
- **Body:** Generous line height (1.5x) to ensure documentation and logs remain readable.

## Layout & Spacing

The design system employs a **fixed-width centered grid** for documentation and marketing views, and a **fluid dashboard grid** for the application environment.

- **Grid Model:** 12-column system with 24px gutters.
- **Rhythm:** An 8px linear scale is used for all internal padding and margins (`8px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Mobile Adaptation:** On mobile, margins shrink to 16px. Grid columns collapse into a single vertical stack. Large code blocks are permitted to scroll horizontally to maintain syntax integrity.

## Elevation & Depth

In this design system, depth is communicated through **Tonal Layering** and **Subtle Outlines** rather than physical shadows.

- **Surface Levels:** 
    - **Level 0 (Background):** Deepest black (`#050505`).
    - **Level 1 (Cards/Panels):** Charcoal gray (`#121214`) with a 1px solid border (`#262629`).
    - **Level 2 (Popovers/Tooltips):** Slightly lighter gray (`#1C1C1F`) with a more pronounced border.
- **Active State Elevation:** When a card or element is focused or active, the border color transitions from neutral gray to the Primary Cyan (`#00F0FF`).
- **Glassmorphism:** Reserved exclusively for navigation bars. A 12px backdrop blur with 80% opacity on the surface color creates a sense of place while scrolling.

## Shapes

The shape language is **Soft (0.25rem)**. 

This subtle rounding provides a modern touch that prevents the UI from feeling "aggressive" or overly retro-brutalist, while remaining sharp enough to feel like a precision instrument. 

- **Standard Elements:** 4px (0.25rem) radius for buttons and inputs.
- **Containers:** 8px (0.5rem) radius for cards and code blocks.
- **Large Sections:** 12px (0.75rem) for massive hero sections or modal wrappers.

## Components

### Buttons
- **Primary:** Solid White background with Black text. No shadow. 4px border radius.
- **Secondary/Technical:** Transparent background with a 1px `#262629` border. Transitions to Primary Cyan border on hover.
- **Ghost:** No background or border. JetBrains Mono font.

### Cards (Infrastructure Primitives)
Cards for features like "Dead Letter Queue" or "Human-in-the-loop" use the Level 1 surface color. They feature a 1px border and an icon in the top-left using the Primary or Secondary accent color.

### Code Blocks
- **Container:** Level 1 background.
- **Header:** A subtle top-bar containing the file name or language type in `label-caps`.
- **Syntax:** Uses the named syntax colors (Comment, Keyword) for a high-end IDE experience.

### Inputs
Minimalist fields with Level 1 background and a subtle border. On focus, the border glows with a soft 2px spread of Primary Cyan.

### Status Chips
Small, mono-spaced badges (e.g., `READY`, `RETRYING`, `FAILED`). These use a low-opacity version of the status color (Green, Yellow, Red) with a high-contrast text label.