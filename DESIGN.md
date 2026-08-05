---
name: LagoAgro
description: Talão do produtor rural — recibo de papel kraft, tinta carimbada, verde de talhão.
colors:
  desk-kraft: "#e3d6b0"
  kraft-paper: "#f7efdb"
  ink-black: "#241f16"
  ink-soft: "#6b6047"
  pencil-line: "#cab88c"
  lagoagro-green: "#166534"
  green-soft: "#dce8dc"
  amber-attention: "#92400e"
  amber-soft: "#f0dfba"
  terracotta-overdue: "#8a2e0e"
  terracotta-soft: "#f0d5bf"
  danger-red: "#9f1d1d"
  danger-soft: "#f3d6d0"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 800
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontWeight: 500
rounded:
  sm: "0.375rem"
  lg: "0.5rem"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.lagoagro-green}"
    textColor: "{colors.kraft-paper}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.lagoagro-green}"
  button-outline:
    backgroundColor: "{colors.kraft-paper}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.sm}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.kraft-paper}"
    rounded: "{rounded.lg}"
  badge:
    rounded: "{rounded.full}"
    typography: "{typography.mono}"
---

# Design System: LagoAgro

## Overview

**Creative North Star: "Talão do Produtor"**

LagoAgro reads as a producer's paper receipt book, not a modern SaaS dashboard. The system is built for a middle-aged-or-older rural user, on a phone, in the field, often in direct sun, sometimes with dirty hands or gloves — not for a designer inspecting it at arm's length on a 27" monitor. Every decision defers to that scene first: card over cleverness, text over icon-only, one accent over a palette, and a warm kraft-paper ground instead of the cream-and-serif look every AI-generated interface reaches for by default.

The color strategy is restrained on purpose: a warm kraft-paper ground carries the whole surface, and the established brand green is the only accent, doing double duty as the "go/confirm/primary" signal. Two extra semantic colors — amber and terracotta — exist solely to mark task urgency (due today, overdue); they are never used as decoration. Numbers wear a monospace face specifically to evoke a stamped receipt number — never as a "technical" costume. Everything else, including headings and body copy, is one confident display face at a handful of weight steps.

The system rejects: soft pastel SaaS gradients, glassmorphism, hero-metric tiles, icon-only controls (this user reads labels, not glyphs), and dark-neon developer-tool aesthetics. It also intentionally does not adopt the generic "cream + serif + terracotta" AI-portfolio look — the type is a grotesk (Archivo), not a serif, and the palette commits to the actual desk/paper scene rather than a bookish one.

**Key Characteristics:**
- Warm kraft-paper ground, restrained color (green is the only true accent)
- One grotesk display face at three weight steps; monospace reserved for numbers/dates/IDs only
- "Stamped" buttons: solid 2px ink border + solid offset shadow that flattens on press, never a blurred drop shadow
- Ticket-paper texture (ruled lines + punched holes) marks the two "receipt" surfaces (login, dashboard task groups) — not used elsewhere
- Icon + visible text together on every control; icon-only is reserved for controls with no room for text (topbar utility icons)
- Mobile-first, single-column, generous touch targets; desktop is the same layout with more breathing room, not a different composition

## Colors

The palette is Restrained: one warm neutral family plus a single brand accent. Everything ships in both a light and a dark rendition — the values below are the light (default) rendition; dark swaps via `prefers-color-scheme` with no manual toggle (see Named Rule below).

### Primary
- **Lagoagro Green** (`#166534`): the one true accent. Primary button fills, active nav pill, focused input border, "concluded/paid" badges. Pre-existing brand color (PWA icon, `theme-color`) — never redefined.

### Neutral
- **Desk Kraft** (`#e3d6b0`): page background — the "desk" the paper receipts sit on. Slightly more saturated than the paper itself so cards read as objects resting on a surface, not flat panels.
- **Kraft Paper** (`#f7efdb`): every card, form, and control surface — the "paper."
- **Ink Black** (`#241f16`): primary text, borders on buttons, stamp-shadow color.
- **Ink Soft** (`#6b6047`): secondary text — labels, metadata, dates when not in mono.
- **Pencil Line** (`#cab88c`): borders, dashed section dividers, ruled-paper texture lines.

### Semantic (task urgency only — never decorative)
- **Amber Attention** (`#92400e` text / `#f0dfba` badge fill): "due today" badge only.
- **Terracotta Overdue** (`#8a2e0e` text / `#f0d5bf` badge fill): "overdue" badge, and the overdue task's own title text.
- **Danger Red** (`#9f1d1d`): destructive-confirm button fill only (the "Confirmar" button inside a delete dialog).

### Named Rules
**The One Accent Rule.** Lagoagro Green is the only brand color with permission to fill a large surface (a button, an active nav pill). Amber and terracotta are reserved strictly for task-urgency badges — never used for anything else, including any other kind of status or emphasis.

**The System-Decides-The-Theme Rule.** Light and dark are both fully designed (see the dark hex values in `frontend/src/index.css`), and the choice is made by `prefers-color-scheme`, never by a UI toggle — the product has no manual theme switch.

## Typography

**Display Font:** Archivo (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Label/Mono Font:** IBM Plex Mono (with `ui-monospace, SFMono-Regular, monospace` fallback)

**Character:** A confident, slightly condensed grotesk carries every heading, label, and body string at weights 600–900 — nothing thin or delicate. IBM Plex Mono appears only for numbers that behave like a stamped ID: dates, currency, quantities, hectares, task counts.

### Hierarchy
- **Page title** (font-black 900, 1.5rem, uppercase, tight tracking): one per screen, via `PageHeader`.
- **Card/section title** (font-black 900, 1.125–1.25rem, uppercase, tight tracking): talhão group name, cultura name.
- **Body/label** (font-bold 700–font-extrabold 800, 1rem): item titles, field labels, button labels.
- **Meta/numeric** (IBM Plex Mono 500, 0.75–0.875rem, `text-ink-soft`): dates, quantities, currency, hectares — always mono, never the display face.
- **Badge label** (IBM Plex Mono 600, 0.75rem, uppercase, wide tracking): status pills (Atrasada / Hoje / Paga / Em andamento).

### Named Rules
**The Mono-Means-Number Rule.** IBM Plex Mono is reserved for values a producer would read off a receipt — dates, R$ amounts, hectares, quantities, badge codes. It never appears on a heading, a button label, or body prose; using it there would break the "stamped number" meaning it's there to carry.

## Layout

Mobile-first, single-column, `max-w-3xl` centered content area under a sticky top app bar. There is no desktop-specific composition — the same stacked layout gains a bit more horizontal grouping at the `sm` breakpoint (640px) via `flex-col → sm:flex-row`, nothing more elaborate.

- **App bar:** sticky, two rows — brand + utility actions (install/notify/sign-out) on top (wraps to two lines itself if it doesn't fit), a horizontally-scrollable pill nav strip below. The nav strip's own `overflow-x-auto` is the only place horizontal scroll is acceptable; nothing else in the app should force page-level horizontal scroll.
- **List rows** (every CRUD page): a card with primary text + metadata/badge on the left and action buttons (Editar/Excluir) on the right. Below `sm`, the row stacks — content on top, actions on their own right-aligned row underneath — specifically because badges and multi-word action labels (e.g. "Pagar diárias pendentes") do not fit beside content in a single non-wrapping row on a ~360–390px phone.
- **Forms:** always inline in the page flow (never a modal) for create/edit — matches the product principle that the system should stay legible and low-friction. The one exception is the destructive-delete confirmation, which is a modal because it protects an irreversible action.
- **Rhythm:** dashed 2px section dividers (`dashed-divider`) instead of solid hairlines wherever a "page header → content" or "row → nested list" boundary needs marking.

### Named Rules
**The No-Squeeze Rule.** Any row combining a text block, a status badge, and one or more action buttons must be allowed to wrap or stack below the `sm` breakpoint. A non-wrapping `justify-between` row is a defect on this product, not an acceptable density trade-off — the target user is on a ~360–390px phone screen.

## Elevation & Depth

Flat by default — no blurred drop shadows, no glassmorphism, no soft ambient glow anywhere in the system. Depth is conveyed entirely through the "stamp" device: a solid, zero-blur, offset shadow that reads as a rubber-stamp impression, and that visibly flattens when a button is pressed.

### Shadow Vocabulary
- **Stamp** (`box-shadow: 3px 3px 0 0 var(--shadow-ink)`): primary and danger buttons. Disappears entirely on `:active`, and the button translates 2px down-right in the same instant — the "ink hits paper" moment.
- **Stamp, small** (`box-shadow: 2px 2px 0 0 var(--shadow-ink)`): every card, outline button.

### Named Rules
**The Solid-Shadow-Only Rule.** Shadows in this system are always a hard, zero-blur offset (the neobrutalist "stamp" device the direction explicitly committed to) — never a soft/blurred `box-shadow`. A blurred shadow anywhere in this codebase is off-system.

## Shapes

Corners are gently rounded, never sharp and never pill-everything: `0.375rem` (buttons, inputs, cards' inner elements) and `0.5rem` (card containers). The one true pill (`rounded-full`) is reserved for the nav strip's pills and status badges — anything meant to read as a small, discrete "stamp" or "tag," not a content container. Borders are consistently 2px solid `pencil-line`/`ink-black` — never a 1px hairline, which would read too quiet against the stamp-shadow language. Dashed 2px borders mark internal section boundaries (never external card edges).

## Components

### Buttons
- **Shape:** `0.375rem` radius, 2px solid border always visible (even on ghost variants' hover state via text color, not a border).
- **Primary** (`bg-accent`, `text-accent-contrast`, uppercase, stamp shadow): the one CTA per section — "+ Propriedade," "Salvar," "Entrar."
- **Outline** (`bg-paper`, `text-ink`, uppercase, small stamp shadow): secondary actions that still deserve a visible boundary — "Tentar novamente," "Pagar diárias pendentes."
- **Ghost / Danger-ghost** (transparent, no border, no shadow, normal case): inline row actions — Editar (`text-ink-soft`), Excluir (`text-rust`, deepens to `text-danger` on hover). Ghost buttons are the one place uppercase is dropped — they read as inline text links, not stamps.
- **Danger** (`bg-danger`, `text-paper`, stamp shadow): the single destructive-confirm button inside a delete dialog.

### Cards
- **Corner:** `0.5rem`.
- **Background:** `kraft-paper`, always with a 2px `pencil-line` border and the small stamp shadow — a card is never borderless or shadowless.
- **Ticket variant** (`ticket-paper` utility): adds the ruled-notebook-line texture plus a column of punched holes on the left margin (2rem gutter). Reserved for the two literal "receipt" surfaces — the login card and each talhão's task group on the dashboard. Not used for ordinary CRUD list cards, which would be too busy at that density.

### Inputs / Fields
- **Style:** `kraft-paper` fill, 2px `pencil-line` border, `0.375rem` radius, bold display-face text (never mono, even for numeric fields — the mono rule applies only to *displayed* values, not to what the user is actively typing).
- **Focus:** border becomes `lagoagro-green`; no glow/ring.
- **Label:** bold, `ink-soft`, sits above the field, never floating/inline.
- **Error:** bold `terracotta-overdue` text directly below the field.

### Badges
- **Style:** full-pill, 1px border in the tone's own color at partial opacity, mono uppercase text, tight padding.
- **Tones:** `neutral` (pending, no urgency), `amber` (due today), `rust` (overdue), `accent` (paid/concluded/in-progress). Tone is fixed to meaning — see Colors → Named Rules.

### Navigation
- **Style:** horizontally-scrollable strip of pill buttons directly under the app bar, always visible (never hidden behind a hamburger — the target user should never have to discover a menu). Active route: solid green fill; inactive: outline pill in `ink-soft` text.
- **Mobile:** identical to desktop — the strip simply scrolls further right on a narrow screen; no collapsing, no reflow.

## Do's and Don'ts

### Do:
- **Do** stack a list row's action buttons below its content at the `sm` breakpoint whenever a badge or a multi-word button label is present (see Layout → The No-Squeeze Rule).
- **Do** pair every icon with visible text; icon-only controls are reserved for the app-bar utility row where there is no room for a label.
- **Do** use the solid offset "stamp" shadow (`3px 3px 0 0` / `2px 2px 0 0`, zero blur) for every card and primary/danger/outline button.
- **Do** reserve IBM Plex Mono strictly for displayed dates, currency, quantities, and badge text.
- **Do** keep forms inline in the page (never a modal) for create/edit; reserve the modal for the destructive-delete confirmation only.

### Don't:
- **Don't** use a blurred or soft `box-shadow` anywhere — this system has one depth device (the solid stamp offset) and no others.
- **Don't** introduce a second accent color for anything decorative; amber and terracotta exist only to mark task urgency.
- **Don't** hide primary navigation behind a hamburger menu or any control the user must discover before using the app.
- **Don't** let a row of text + badge + action buttons overflow or squeeze onto one non-wrapping line below the `sm` breakpoint — wrap or stack it.
- **Don't** reach for a serif face or a cream-plus-serif "AI portfolio" look; the committed world is a stamped receipt book in a grotesk, not a bookish/editorial one.
