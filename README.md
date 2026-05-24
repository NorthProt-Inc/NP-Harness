# NP-Harness

Public-safe Pi coding-agent harness configuration for NorthProt workflows.

This repository is a sanitized, restorable snapshot of Pi customizations: skills, prompt templates, extensions, themes, agents, kits, and local Pi packages. It intentionally excludes credentials, private memory, sessions, logs, and other runtime data.

## Included

- `AGENTS.md` global operating rules
- `agents/` subagent definitions
- `extensions/` local Pi extensions
- `skills/` local skills
- `prompts/` slash prompt templates
- `themes/` public-safe theme files
- `kits/` Pi kit assets
- `packages/` local Pi packages
- `settings.template.json` portable Pi settings template
- `mcp.example.json` placeholder MCP config shape

## Excluded by design

- `auth.json`, `mcp.json`, API keys, tokens, and OAuth state
- MCP caches and generated metadata
- `sessions/`, `logs/`, `.remember/`, campaign state, and backups
- personal memory files under `memory/`
- `node_modules/` and nested package runtime state

## Quick restore

See [`RESTORE.md`](RESTORE.md).

Short version:

```bash
mkdir -p ~/.pi
rsync -a --exclude .git ./ ~/.pi/agent/
cd ~/.pi/agent
npm install --ignore-scripts
node scripts/render-settings.mjs
cp mcp.example.json mcp.json  # then edit placeholders locally; never commit it
```

## Security note

This repository is intended to be safe for a public GitHub repository. Still, re-run a secret scan before publishing changes.
