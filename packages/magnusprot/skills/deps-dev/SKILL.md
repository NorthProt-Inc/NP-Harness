---
name: deps-dev
description: Use when checking outdated deps or running security audit
metadata:
  pi:
    argument-hint: '[--audit|--outdated|--tree]'
    user-invocable: true
---

# /deps - Dependency Management

Checks project dependency status, security vulnerabilities, and updates.

## Usage
- `/deps` - Full summary (outdated + audit)
- `/deps --audit` - Security vulnerabilities only
- `/deps --outdated` - Updatable packages only
- `/deps --tree` - Dependency tree

## Arguments: $ARGUMENTS

## Behavior

### Step 1: Detect Project Type
Determined by file existence:
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json` -> Node.js (pnpm)
- `package-lock.json` -> Node.js (npm)
- `pyproject.toml`, `requirements.txt`, `setup.py` -> Python
- `Cargo.toml` -> Rust
- `go.mod` -> Go

### Step 2: Node.js Project (pnpm)
```bash
# Outdated packages
pnpm outdated 2>/dev/null

# Security audit
pnpm audit 2>/dev/null

# Dependency tree (--tree option)
pnpm ls --depth=2 2>/dev/null
```

### Step 3: Python Project
```bash
# Outdated packages
pip list --outdated --format=columns 2>/dev/null

# Security audit (if pip-audit installed)
pip-audit 2>/dev/null || echo "pip-audit not installed (pip install pip-audit)"

# Dependency tree (--tree option)
pipdeptree 2>/dev/null || pip show <package> 2>/dev/null
```

### Step 4: Rust Project
```bash
cargo outdated 2>/dev/null
cargo audit 2>/dev/null
```

## Output Format
```
## Dependency Status

### Project Type: Node.js (pnpm monorepo)

### Security Vulnerabilities (N)
| Package | Current | Fixed Version | Severity | CVE |
|---------|---------|--------------|----------|-----|
| lodash | 4.17.20 | 4.17.21 | HIGH | CVE-2021-XXXX |

### Updatable (N)
| Package | Current | Latest | Type |
|---------|---------|--------|------|
| zod | 3.22.0 | 3.24.0 | minor |

### Recommended Actions
1. Immediately update packages with security vulnerabilities
2. Review changelogs before applying major updates
```
