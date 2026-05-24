# Restore NP-Harness

## 1. Copy into the Pi agent directory

```bash
mkdir -p ~/.pi
rsync -a --exclude .git ./ ~/.pi/agent/
```

## 2. Install dependencies

```bash
cd ~/.pi/agent
npm install --ignore-scripts
```

Some bundled packages include their own TypeScript/test dependencies. Install inside those package directories only if you plan to develop them.

## 3. Render local settings

```bash
node scripts/render-settings.mjs
```

This converts `settings.template.json` into local-only `settings.json` by replacing:

- `${PI_AGENT_DIR}` with `$PI_AGENT_DIR`, `$PI_CODING_AGENT_DIR`, or `~/.pi/agent`
- `${HOME}` with your home directory

Do not commit the rendered `settings.json` if you add local/private entries.

## 4. Configure MCP locally

```bash
cp mcp.example.json mcp.json
$EDITOR mcp.json
```

Use environment-variable placeholders for API keys. Never commit `mcp.json`, OAuth tokens, or MCP caches.

## 5. Verify

```bash
pi --no-session --verbose
```

If Pi reports missing package dependencies, run `npm install --ignore-scripts` in the affected package directory.
