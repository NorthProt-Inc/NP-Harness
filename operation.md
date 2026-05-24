# NP-Harness Operations

This document covers install, configuration, verification, and troubleshooting for the NP-Harness Pi agent configuration repository.

## Install

Clone the public repository:

```bash
git clone https://github.com/NorthProt-Inc/NP-Harness.git
cd NP-Harness
```

Copy it into the Pi agent directory:

```bash
mkdir -p ~/.pi
rsync -a --exclude .git ./ ~/.pi/agent/
```

Install root dependencies used by Pi packages and helper scripts:

```bash
cd ~/.pi/agent
npm install --ignore-scripts
```

## Configuration

Render local Pi settings from the portable template:

```bash
node scripts/render-settings.mjs
```

The render script writes `settings.json` locally by replacing these placeholders:

| Placeholder | Source |
|---|---|
| `${PI_AGENT_DIR}` | `$PI_AGENT_DIR`, `$PI_CODING_AGENT_DIR`, or `$HOME/.pi/agent` |
| `${HOME}` | `$HOME` |

Configure MCP locally only after restore:

```bash
cp mcp.example.json mcp.json
$EDITOR mcp.json
```

Use environment-variable references for real API tokens. Do not commit `mcp.json`.

## Run

Start Pi normally after restore:

```bash
pi
```

For a verification run without saving a session:

```bash
pi --no-session --verbose
```

There is no production daemon, systemd service, Dockerfile, compose file, or Procfile in this repository.

## Debug

### Check generated settings

```bash
node scripts/render-settings.mjs
python3 -m json.tool settings.json >/dev/null
```

### Check public safety

```bash
node scripts/secret-scan.mjs
```

### Check tracked private files

```bash
git ls-files | grep -E '(^|/)(auth\.json|mcp\.json|settings\.json|node_modules/|sessions/|logs/|memory/|\.remember/|codex-plugin-data/|backups/|\.pi/)'
```

Expected output: none.

### Check package health

```bash
npm audit --omit=dev
cd packages/pi-kits
npm install --ignore-scripts
npm run typecheck
npm test
```

## Ops Checklist

Before pushing to the public repository:

1. Confirm no real `settings.json`, `mcp.json`, auth files, memory, logs, sessions, or `.remember/` files are tracked.
2. Run `node scripts/secret-scan.mjs`.
3. Validate `settings.template.json` and `mcp.example.json` with `python3 -m json.tool`.
4. Run package checks for any package you changed.
5. Review `git diff --cached` before committing.

## Troubleshooting

| Symptom | Check | Fix |
|---|---|---|
| Pi cannot find a skill or package | `settings.json` paths | Run `node scripts/render-settings.mjs` again. |
| MCP tools are missing | local `mcp.json` | Copy `mcp.example.json` to `mcp.json` and configure real local servers. |
| Secret scan fails | scanner output path | Remove or template the flagged value; rotate any leaked credential. |
| `pi-kits` typecheck fails | package dependencies | Run `npm install --ignore-scripts` inside `packages/pi-kits`. |
| Git wants to add runtime files | `.gitignore` coverage | Add ignore rules before committing. |

## Environment Variables

| Variable | Required | Purpose |
|---|---:|---|
| `PI_AGENT_DIR` | No | Preferred target Pi agent directory override for render/settings helpers. |
| `PI_CODING_AGENT_DIR` | No | Native Pi config directory override. |
| `HOME` | Yes | Default base for `~/.pi/agent`. |
| `EXAMPLE_API_KEY` | No | Placeholder in `mcp.example.json`; replace for real local MCP servers. |
| `EXAMPLE_API_TOKEN` | No | Placeholder in `mcp.example.json`; replace for real local MCP servers. |
