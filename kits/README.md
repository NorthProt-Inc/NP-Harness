# Pi Kits catalog

This directory is the global catalog scanned by the `/kits` command.

## Layout

```text
kits/
  skills/
    <name>/
      SKILL.md
  prompts/
    <name>.md
  extensions/
    <name>.ts
    <package-extension>/
      package.json
      src/index.ts
  bundles/
    <name>.json
```

## Add a skill

Create `skills/<name>/SKILL.md`:

```markdown
---
name: example-skill
description: What this skill helps with
---

# Example skill

Instructions for the agent.
```

The resource key will be `skill:<name>`.

## Add a prompt

Create `prompts/<name>.md`:

```markdown
---
description: Short prompt description
---

Your prompt text.
```

The resource key will be `prompt:<name>`.

## Add a single-file extension

Create `extensions/<name>.ts` with a normal Pi extension default export.

The resource key will be `extension:<name>`. Pi Kits copies it to the target project's `.pi/extensions/<name>.ts`.

## Add a package extension

Create a package directory with `package.json`:

```text
extensions/example-package/
  package.json
  src/index.ts
```

Example `package.json`:

```json
{
  "name": "example-package",
  "type": "module",
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

The resource key will be `extension:example-package`. Pi Kits references the catalog package directory in the target project's `.pi/settings.json` `extensions[]`; it does not vendor package files in the MVP.

## Add a bundle

Create `bundles/<name>.json`:

```json
{
  "name": "frontend",
  "description": "Frontend kit",
  "resources": [
    "skill:frontend-design",
    "prompt:ui-review",
    "extension:component-preview"
  ]
}
```

The resource key will be `bundle:<name>`. Bundles expand to concrete non-bundle resources before installation.

## Safety exclusions

Do not put secrets in this catalog. Pi Kits MVP does not support MCP resources and must not read or write `~/.pi/agent/mcp.json`, auth files, secret files, or `.env*` files.
