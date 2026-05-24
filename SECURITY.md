# Security Policy

Do not commit secrets, OAuth files, MCP runtime configs, session logs, memory files, or machine-local state.

Before publishing changes, run a secret scan and check for local paths or personal identifiers:

```bash
node scripts/secret-scan.mjs
rg -n '/home/|auth\.json|mcp\.json|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_' .
```

If a secret was committed, rotate it immediately and rewrite history before making the repository public.
