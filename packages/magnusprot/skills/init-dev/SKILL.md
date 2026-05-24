---
name: init-dev
description: Use when loading project context — scan configs, deps, git state
metadata:
  pi:
    model: haiku
    user-invocable: true
---

# /project-init - Project Initialization Context

Loads project context and environment diagnostics for quickly understanding a project in a new session.

## Behavior

### 1. Project Metadata
Check the following files:
- `README.md` - Project overview
- `pyproject.toml` or `setup.py` - Python project info
- `package.json` - Node.js project info
- `Cargo.toml` - Rust project info
- `.pi/` or `.claude/` project agent settings (treat `.claude/` as legacy compatibility)

### 2. Directory Structure
```bash
tree -L 2 -d --noreport
```

### 3. Key Config Files
- `.env.example` - Environment variable template
- `docker-compose.yml` - Service configuration
- `Makefile` - Build/run commands

### 4. Entrypoint Identification
- `main.py`, `app.py`, `index.ts`, etc.
- Main modules in `src/` or `lib/`

### 5. System & Tool Versions
```bash
uname -sr
python3 --version 2>/dev/null
node --version 2>/dev/null
git --version
```

### 6. Language-Specific Environment

#### Python
```bash
echo "VIRTUAL_ENV: $VIRTUAL_ENV"
which python3
pip --version 2>/dev/null
ruff --version 2>/dev/null
pytest --version 2>/dev/null
mypy --version 2>/dev/null
```

#### Node.js/TypeScript
```bash
node --version 2>/dev/null
pnpm --version 2>/dev/null
npx biome --version 2>/dev/null
npx tsc --version 2>/dev/null
```

### 7. Project Config File Check
Check existence of:
- `pyproject.toml` / `setup.py` / `requirements.txt`
- `package.json` / `pnpm-workspace.yaml` / `tsconfig.json`
- `.env` / `.env.example`
- `Makefile` / `docker-compose.yml`
- `.gitignore`

### 8. Git Status & Recent Changes
```bash
git remote -v 2>/dev/null
git branch --show-current 2>/dev/null
git stash list 2>/dev/null
git log --oneline -10
git diff --stat HEAD~5
```

### 9. Disk Usage
```bash
du -sh . 2>/dev/null
du -sh .git 2>/dev/null
du -sh node_modules 2>/dev/null
```

## Output Format

```markdown
## Project Context

### Overview
- Name: project-name
- Type: Python/FastAPI
- Description: ...

### Structure
src/
  api/
  core/
  models/
  utils/
tests/

### Key Files
- Entrypoint: `src/main.py`
- Config: `src/core/config.py`
- Routes: `src/api/routes/`

### Main Dependencies
- FastAPI 0.100+
- SQLAlchemy 2.0+

### Environment
| Tool | Status | Version |
|------|--------|---------|
| Python | OK | 3.12.x |
| ruff | OK | 0.x.x |
| pytest | OK | 8.x |
| mypy | OK | 1.x |

### Config Files
| File | Status |
|------|--------|
| pyproject.toml | OK |
| .env.example | OK |
| .gitignore | OK |

### Git
- Remote: origin -> git@github.com:...
- Branch: main
- Stash: 2

### Recent Work
- feat: add user authentication
- fix: database connection error

### Warnings
- Missing .env: recommend copying from .env.example
```

## Use Cases
1. Starting a new pi working session
2. Revisiting a project after a long break
3. Diagnosing environment issues
