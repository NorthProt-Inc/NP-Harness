---
name: web-artifacts-builder
description: Suite of tools for creating elaborate, multi-component standalone HTML artifacts in Pi using React, Tailwind CSS, and shadcn/ui. Use for complex artifacts requiring state management, routing, or shadcn/ui components. Do not use for simple single-file HTML/JSX artifacts; use frontend-design instead.
license: Complete terms in LICENSE.txt
metadata:
  pi:
    ported-from: anthropics/skills@web-artifacts-builder
    output: standalone bundle.html
---

# Web Artifacts Builder for Pi

Build complex interactive web artifacts as local React projects, then bundle them into a single self-contained `bundle.html` file that can be opened, inspected, or shared from Pi.

Pi does not have Claude.ai's Artifact panel. In Pi, the deliverable is the generated `bundle.html` path plus an optional browser/Playwright preview when useful.

## Scope Gate

Use this skill for:
- Multi-component interactive HTML artifacts
- React artifacts with state management, routing-like views, tabs, dashboards, or forms
- UI that benefits from Tailwind CSS and shadcn/ui components
- Deliverables intended to be a single portable HTML file

Do not use this skill for:
- Simple static HTML/CSS/JS snippets — use `frontend-design`
- Production app changes inside an existing React/Next.js repo — use `enhanced-frontend`
- Project design-system architecture — use `enhanced-frontend`

## Workflow

1. Resolve this skill directory. In this install it is usually:
   `${PI_AGENT_DIR:-$HOME/.pi/agent}/skills/web-artifacts-builder`
2. Create or choose a working directory for the artifact project.
3. Initialize the React project using the script from this skill directory.
4. Develop by editing the generated project files.
5. Run the bundler from the generated project root.
6. Return the absolute path to `bundle.html`. Preview with Playwright/browser if requested or if visual verification is important.

**Stack**: React 18 + TypeScript + Vite + Parcel bundling + Tailwind CSS 3.4 + shadcn/ui + Radix UI dependencies.

## Design Guidance

Avoid generic AI-looking UI: excessive centered layouts, purple gradients, uniform rounded corners, and default Inter-heavy styling. Choose a clear visual direction and make typography, spacing, color, and motion feel intentional.

## Step 1: Initialize Project

Run from the directory where the artifact project should be created. Use the script by absolute path so it works regardless of the current Pi session directory:

```bash
bash ${PI_AGENT_DIR:-$HOME/.pi/agent}/skills/web-artifacts-builder/scripts/init-artifact.sh <project-name>
cd <project-name>
```

The script creates a configured project with:
- React + TypeScript via Vite
- Tailwind CSS 3.4.1 with shadcn/ui theming
- `@/` path aliases
- 40+ shadcn/ui components
- Radix UI dependencies
- Parcel config for single-file bundling
- Node 18+ compatibility handling

## Step 2: Develop the Artifact

Edit the generated files, usually:

```text
src/App.tsx
src/index.css
src/components/ui/*
```

Keep the output self-contained. Avoid external assets unless they are inlined or safely bundled.

## Step 3: Bundle to Single HTML

Run from the generated project root, where `package.json` and `index.html` live:

```bash
bash ${PI_AGENT_DIR:-$HOME/.pi/agent}/skills/web-artifacts-builder/scripts/bundle-artifact.sh
```

This creates:

```text
bundle.html
```

The bundler installs Parcel/html-inline helper dependencies, builds the app, and inlines all assets into one HTML file.

## Step 4: Present or Preview in Pi

Return the absolute path, for example:

```text
Created: /path/to/project/bundle.html
```

If previewing is needed, use one of:

```bash
python3 -m http.server 4173
# then open http://127.0.0.1:4173/bundle.html
```

or use Playwright to navigate to the local file/HTTP URL and capture console errors or screenshots.

## Reference

- shadcn/ui components: https://ui.shadcn.com/docs/components
