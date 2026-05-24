---
name: security-dev
description: Use when scanning for security vulns — secrets, injection, unsafe APIs
metadata:
  pi:
    model: sonnet
    argument-hint: '[path]'
    user-invocable: true
---

# /security - Security Vulnerability Scan

Analyzes the codebase for security vulnerabilities.

## Arguments
- `$ARGUMENTS`: Path to scan (optional, default: entire project)

## Checks

### 1. Hardcoded Secrets
Search for these patterns:
- `password = "..."`, `api_key = "..."`
- `secret = "..."`, `token = "..."`
- AWS key patterns: `AKIA...`
- Long base64 strings

### 2. Injection Vulnerabilities

#### Python
- **SQL Injection**: f-string query composition
- **Command Injection**: `os.system()`, `subprocess` with `shell=True`
- **XSS**: User input output without HTML escaping

#### TypeScript
- **Command Injection**: `child_process.exec()`, `{ shell: true }` option
- **Prototype pollution**: `Object.assign()` with untrusted input, `__proto__` access
- **Path traversal**: `path.join()` without `path.resolve()` + boundary check
- **SQL Injection**: Template literal query composition

### 3. Unsafe Functions

#### Python
- `eval()`, `exec()`
- `pickle.loads()` (untrusted input)
- `yaml.load()` without `Loader=SafeLoader`

#### TypeScript
- `eval()`, `new Function()`
- `innerHTML` with user input
- `child_process.exec()` (prefer `execFile` or `spawn`)

### 4. Configuration Issues
- Debug mode enabled: `DEBUG = True`, `NODE_ENV !== 'production'`
- Permissive CORS: `origins = ["*"]`, `origin: '*'`
- No HTTPS

### 5. Dependency Vulnerabilities
Run if tools are installed:
- Python: `pip-audit` or `safety check`
- Node.js: `pnpm audit`

### 6. MCP / Plugin Config Audit

Inspect AI tooling configs for untrusted execution paths:

- **Project `.mcp.json`** and **`.claude/settings.json`** (if present)
- **User `~/.claude/settings.json`** (audit only when scoped to user config)

Flag for each MCP server entry:
- `"command"` that points to a non-standard binary (not `npx`, `uvx`, or a vetted package)
- Shell-wrapped commands: `"sh -c ..."`, `"bash -c ..."`
- `"env"` blocks containing raw secrets (API keys, tokens) instead of `${ENV_VAR}` references
- Servers pulled from a `source` repo that isn't pinned to a tag/commit
- Permissions `allow` list with over-broad patterns such as unrestricted Bash or wildcard MCP tool access

Flag for plugins:
- Enabled plugin from a marketplace not in `extraKnownMarketplaces`
- Plugin hook `command` with inline shell that writes outside the project

## Commands (Internal)

```bash
# Python: Hardcoded secrets
grep -rn --include="*.py" -E "(password|api_key|secret|token)\s*=\s*['\"][^'\"]+['\"]" .

# Python: Dangerous functions
grep -rn --include="*.py" -E "\b(eval|exec|os\.system)\b" .

# Python: shell=True
grep -rn --include="*.py" "shell\s*=\s*True" .

# TypeScript: child_process.exec
grep -rn --include="*.ts" --include="*.js" "child_process.*exec\b\|\.exec(" .

# TypeScript: shell: true
grep -rn --include="*.ts" --include="*.js" "shell:\s*true" .

# TypeScript: prototype pollution
grep -rn --include="*.ts" --include="*.js" "__proto__\|prototype\[" .

# Debug mode
grep -rn --include="*.py" "DEBUG\s*=\s*True" .
```

## Output Format

```
## Security Scan Results

### Summary
- Critical: N
- High: N
- Medium: N
- Low: N

### Details

#### [CRITICAL] Hardcoded API Key
- Location: `src/config.py:42`
- Content: `API_KEY = "sk-xxxx..."`
- Recommended: Use environment variables or secret manager

#### [HIGH] SQL Injection Risk
- Location: `src/db/queries.py:28`
- Content: `f"SELECT * FROM users WHERE id = {user_id}"`
- Recommended: Use parameter binding
```

## Notes
- False positives are possible -- verify context
- This is a basic scan and does not replace professional security audits
- Fix discovered vulnerabilities immediately or file issues
