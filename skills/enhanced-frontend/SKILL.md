---
name: enhanced-frontend
description: >
  Advanced frontend design system for production React/Next.js projects. Provides animation
  decision criteria (CSS vs Framer Motion), curated style database, industry UX rules, stack
  compatibility guidance (Tailwind v3/v4), and 21st.dev component integration. Use for substantial
  frontend work: landing pages, redesigns, new features, design system generation. For quick
  artifacts, use web-artifacts-builder. For quick single components, use frontend-design.
---

# Enhanced Frontend Design System

Production-grade frontend design intelligence. Layers on top of project-specific design refs
(arcivus-design-ref, sci-design-ref, etc.) to provide cross-project decision criteria.

---

## 1. Scope Gate

| Task | Use This Skill | Use Instead |
|------|---------------|-------------|
| Full page/feature build | Yes | — |
| Design system creation | Yes | — |
| Landing page, redesign | Yes | — |
| Animation architecture decisions | Yes | — |
| Quick HTML artifact for claude.ai | No | `web-artifacts-builder` |
| Quick single component/styling | No | `frontend-design` |
| Project-specific token audit | No | Project's `*-design-ref` skill |

---

## 2. Animation Decision Tree

### When to use CSS-only

- **Scroll reveals**: IntersectionObserver + opacity/transform transitions
  - Pattern: northprot.com's `useReveal` hook (IO + `.reveal`/`.revealed` CSS classes)
  - Pattern: Arcivus's `AnimatedSection` wrapping framer-motion (but the IO trigger itself is CSS-compatible)
- **Hover/focus states**: `transition-colors`, `transition-transform`, `transition-opacity`
- **Infinite loops**: marquee, pulse, spin (`animate-spin`, `animate-pulse`)
- **Decorative transitions**: color shifts, border changes, simple fades
- **No framer-motion in project**: If `package.json` has no `framer-motion`, default to CSS
- **Static/marketing pages**: Where motion is ornamental, not informational

### When to use Framer Motion

- **Layout animations**: Elements changing position/size smoothly (`layout` prop)
- **Shared element transitions**: Cross-view morphing (`layoutId`)
- **Gesture-driven**: Drag, whileHover/whileTap with spring physics
- **AnimatePresence**: Enter/exit animations (mount/unmount transitions)
- **Scroll-linked transforms**: `useScroll` + `useTransform` for parallax, progress bars
- **Staggered orchestration**: `variants` with `staggerChildren` for list reveals
- **Number/text morphing**: Animated counters, text transitions
- **Biological/scientific process animations**: Where motion conveys information (central dogma, NMD)
- **Spring physics**: Natural-feeling interactive elements (draggable, bounceless springs)

### Decision heuristic

```
Is the animation purely decorative?
  Yes → CSS
  No ↓
Does it require JS state (enter/exit, gesture, scroll position)?
  Yes → Framer Motion
  No ↓
Does it need spring physics or layout animation?
  Yes → Framer Motion
  No → CSS
```

### Import pattern

```tsx
// Package name is still "framer-motion" (npm), not "motion"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// Next.js: must be in a client component
"use client";
```

### Accessibility — non-negotiable

- Always check `useReducedMotion()` (framer-motion) or `prefers-reduced-motion` (CSS)
- Disable autoplay, complex animations, parallax when reduced motion is preferred
- Content must remain fully accessible without motion

---

## 3. Industry UX Rules

### Developer Portfolio / Personal Brand
- Hero section: name + role + one action. No carousel, no animation overload
- Project cards: screenshot + tech stack + link. Not a blog post
- Performance IS the portfolio — Lighthouse 90+ or the site undermines its own pitch
- Dark mode support expected. Single-theme is acceptable if intentional

### SaaS Dashboard
- Data density over decoration. Users scan, not browse
- Consistent card/panel sizing. Grid alignment is trust
- Loading states: skeleton, not spinner. Show shape of incoming data
- Color: semantic only (red=error, green=success, blue=info). No decorative gradients

### Research / Scientific Communication
- Typography hierarchy: serif/display for headings, sans for body, monospace for notation
- Data integrity: never round, truncate, or approximate scientific values for aesthetics
- Visualization: domain colors must be semantically meaningful and consistent
- Whitespace: generous. Scientific content needs room to breathe
- No bounce/elastic easing on scientific data — it trivializes content

### AI/ML Product Interface
- Model output areas: visually distinct from static content (subtle background, border)
- Streaming text: cursor blink or fade-in, not typewriter per-character
- Confidence/uncertainty: communicate clearly, don't hide behind progress bars
- Latency: always show processing state. Never leave user wondering if it's working

### Biotech / Medical
- Content safety: distinguish research data from personal medical information
- Accessibility: WCAG AA minimum. Color-blind safe palettes for all data visualization
- Trust signals: clean, institutional aesthetic. Avoid startup-trendy design
- Imprinting/genetics: color assignments must match biological convention

---

## 4. Stack Compatibility Matrix

### Tailwind v4 (Arcivus, northprot.com)
- Config: CSS-based `@theme inline` in `tokens.css` or `globals.css`
- NO `tailwind.config.js` / `tailwind.config.ts`
- Import: `@import "tailwindcss"`
- Custom tokens: `--color-*`, `--spacing-*`, `--font-*` in `@theme` block
- Utility generation: automatic from CSS variables
- 21st.dev components target Tailwind v3 — adapt class names when importing

### Tailwind v3 (sgce-explorer)
- Config: `tailwind.config.js` with `content`, `theme.extend`, `plugins`
- Import: `@tailwind base; @tailwind components; @tailwind utilities;`
- 21st.dev components are directly compatible

### React 19 + Next.js 16 (northprot.com)
- Server Components by default; `"use client"` for interactivity
- `use()` hook for promises/context
- `ref` as regular prop (no `forwardRef` needed)

### React 18 + Next.js 15 (Arcivus)
- App Router, Server Components
- `forwardRef` still needed for ref forwarding
- `"use client"` for framer-motion, 3Dmol.js, and interactive components

### React 18 + Vite (sgce-explorer)
- Client-only SPA, no server components
- All components are client components by default
- Direct framer-motion usage without `"use client"` directive

---

## 5. 21st.dev Integration Guide

### What it provides
- 1000+ community React components (Tailwind + Radix UI + Framer Motion)
- MCP server: generates components from natural language prompts
- "Copy prompt" feature on 21st.dev website for manual component sourcing

### MCP usage pattern
When the `21st-dev-magic` MCP server is configured, use it for:
- Complex component scaffolding (data tables, multi-step forms, dashboard widgets)
- Animation-rich UI elements (hero sections, interactive cards, navigation)
- Rapid prototyping of new page sections

### Mandatory adaptation rules
1. **Never paste-and-use**: Always adapt generated components to project's design system
2. **Tailwind version**: Convert v3 classes to v4 syntax for Arcivus/northprot projects
3. **Token compliance**: Replace hardcoded colors/spacing with project tokens
4. **Import cleanup**: Remove unused dependencies, align with project's component library
5. **Accessibility**: Add `aria-*` attributes, keyboard navigation, reduced motion support

### When NOT to use 21st.dev
- Explorer/scientific visualization components (too domain-specific)
- Components that must match an existing design system exactly
- Simple elements faster to write by hand than to adapt from a template

---

## 6. Style Database

For new projects or major redesigns, reference curated style profiles in
`references/styles.md`. Each profile provides:
- Color palette (5-7 hex values)
- Font pairing (Google Fonts: display + body)
- Layout tendency and mood
- Appropriate project types

Load the reference file when the user asks to:
- Choose a visual direction for a new project
- Redesign an existing project's aesthetic
- Explore style options before committing

---

## 7. Design System Generation (Master + Overrides)

For projects that need a formal design system:

### Structure
```
design-system/
  MASTER.md          # Global tokens: colors, fonts, spacing, radius, shadows
  pages/
    home.md          # Page-level overrides (e.g., hero uses display font at 4xl)
    dashboard.md     # Dashboard-specific density rules
```

### Workflow
1. Analyze project requirements and target audience
2. Select or generate style profile (from references/styles.md or custom)
3. Write MASTER.md with all design tokens
4. For each distinct page type, write override file if defaults don't fit
5. Implement tokens as CSS variables (Tailwind v4 `@theme`) or config (v3)

### Token categories
- **Color**: primary, secondary, accent, neutral scale (50-950), semantic (success/warning/error)
- **Typography**: font families, size scale, weight scale, line-height scale
- **Spacing**: consistent scale (4px base recommended)
- **Border radius**: consistent scale (sm/md/lg/xl/2xl)
- **Shadows**: elevation scale (sm/md/lg/xl)
- **Duration/easing**: animation tokens
