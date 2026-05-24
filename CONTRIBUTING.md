# Contributing to NP-Harness

NP-Harness is a public-safe Pi agent configuration snapshot. Contributions should preserve restorability without exposing private machine state, credentials, memory, or session data.

## Ground Rules

- Do not commit secrets, API keys, OAuth files, live MCP configs, or `.env` files.
- Do not commit personal memory, sessions, logs, `.remember/`, campaign state, backups, or generated caches.
- Keep `settings.template.json` portable. Do not add machine-local absolute paths.
- Put real local MCP server configuration in `mcp.json` only; it is intentionally ignored.
- Derive documentation from actual files and package manifests.

## Setup

```bash
git clone https://github.com/NorthProt-Inc/NP-Harness.git
cd NP-Harness
npm install --ignore-scripts
```

For package development, install dependencies inside the changed package directory as needed.

## Verification Before Commit

Run the public-safety and syntax checks:

```bash
node scripts/secret-scan.mjs
python3 -m json.tool settings.template.json >/dev/null
python3 -m json.tool mcp.example.json >/dev/null
npm audit --omit=dev
```

If you change `packages/pi-kits`:

```bash
cd packages/pi-kits
npm install --ignore-scripts
npm run typecheck
npm test
```

Before committing, confirm no runtime/private files are tracked:

```bash
git ls-files | grep -E '(^|/)(auth\.json|mcp\.json|settings\.json|node_modules/|sessions/|logs/|memory/|\.remember/|codex-plugin-data/|backups/|\.pi/)'
```

Expected output: none.

## Commit Style

Use concise Conventional Commit messages, for example:

- `docs: update restore guide`
- `chore: refresh public-safe pi settings template`
- `fix: remove local path from pi-kits helper`

## If a Secret Is Committed

1. Rotate the secret immediately.
2. Remove it from the working tree.
3. Rewrite history before pushing, or contact a maintainer if it has already been pushed.
4. Re-run `node scripts/secret-scan.mjs`.
