# Pi Kits

Pi Kits adds the `/kits` command to Pi. It installs reusable global resources from `~/.pi/agent/kits/` into the current project's `.pi/` directory and tracks ownership in `.pi/kits.json`.

## Commands

```text
/kits
```

Opens an overlay selector. Use Up/Down to move, Space to toggle a resource or bundle, Enter to apply the desired state, and Esc to cancel.

```text
/kits status
```

Shows catalog paths, managed resources, catalog warnings, and manifest drift warnings.

After applying changes, run:

```text
/reload
```

Reloading makes newly installed skills, prompts, and extensions available in the active Pi session.

## Catalog layout

Pi Kits scans this fixed local catalog root:

```text
~/.pi/agent/kits/
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

Resource keys are stable:

| Resource | Key format | Install behavior |
| --- | --- | --- |
| Skill | `skill:<name>` | Copy `kits/skills/<name>/` to `.pi/skills/<name>/` |
| Prompt | `prompt:<name>` | Copy `kits/prompts/<name>.md` to `.pi/prompts/<name>.md` |
| Single-file extension | `extension:<name>` | Copy `kits/extensions/<name>.ts` to `.pi/extensions/<name>.ts` |
| Package extension | `extension:<name>` | Reference the catalog package directory in `.pi/settings.json` `extensions[]` |
| Bundle | `bundle:<name>` | Expand to concrete resource keys; bundles are not manifest entries |

Package extensions must have `package.json`. Extension directories with only `index.ts` are intentionally out of the MVP; use a single-file `.ts` extension or add package metadata.

## Bundle format

Create `kits/bundles/frontend.json`:

```json
{
  "name": "frontend",
  "description": "Frontend design and review kit",
  "resources": [
    "skill:frontend-design",
    "prompt:ui-review",
    "extension:component-preview"
  ]
}
```

Bundles may reference other bundles. Pi Kits expands bundles to non-bundle resource keys and warns about missing resources or cycles.

## Manifest and ownership

Each project gets a manifest at:

```text
.pi/kits.json
```

The manifest records installed resource keys, source paths, target paths, catalog fingerprints, and managed settings changes. Removal only deletes manifest-managed target paths and manifest-owned settings references.

If a package extension reference already existed in `.pi/settings.json` before Pi Kits applied it, Pi Kits does not claim ownership of that pre-existing reference and will not remove it later.

## Safety rules

Pi Kits is intentionally conservative:

- It refuses to overwrite existing unmanaged target files or directories.
- It preserves unrelated `.pi/settings.json` fields.
- It sorts and deduplicates `.pi/settings.json` `extensions[]`.
- It reports drift when managed targets, settings references, or catalog sources are missing.
- It does not bypass Pi's permission or safety systems.
- It does not support MCP resources in the MVP.
- It must not read or write secrets, auth files, `~/.pi/agent/mcp.json`, or `.env*` files.

## Development

From this package directory:

```bash
npm test
npm run typecheck
```

See also `docs/install-modes.md` for the copy/reference install mode rationale.
