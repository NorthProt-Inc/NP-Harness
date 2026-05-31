---
name: commit-dev
description: Use when committing — auto-format as Conventional Commits
metadata:
  pi:
    user-invocable: true
---

# /commit-conv - Conventional Commit

Commits using [Conventional Commits](https://www.conventionalcommits.org/) format.

## Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | feat: add user login |
| `fix` | Bug fix | fix: handle null pointer exception |
| `docs` | Documentation change | docs: update API docs |
| `style` | Formatting (no behavior change) | style: fix indentation |
| `refactor` | Refactoring | refactor: remove duplicate code |
| `test` | Add/modify tests | test: add login tests |
| `chore` | Build, config changes | chore: update dependencies |
| `perf` | Performance improvement | perf: optimize query |
| `ci` | CI configuration | ci: add GitHub Actions |

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Example
```
feat(auth): add password reset

- Send reset link via email
- Token expires in 24 hours
- Password complexity validation

Closes #123
```

## Behavior

### 1. Check Changes
```bash
git status
git diff --staged
```

### 2. Pre-commit Gate (BLOCKING)

Before composing the message, run the project's typecheck/lint if configured. Do NOT commit with type errors.

Detect and run in order:
- **TypeScript/Node**: `npm run typecheck` or `tsc --noEmit` if a `tsconfig.json` exists and the script is defined
- **Python**: `pyright` or `mypy` if configured (`pyrightconfig.json`, `mypy.ini`, or `[tool.mypy]` in `pyproject.toml`)
- **Lint**: `npm run lint` / `ruff check .` if the project configures it

If any gate fails → STOP, report errors to user, do NOT commit.
If no gate is configured → proceed (don't invent one).

Also verify git identity is set:
```bash
git config user.name && git config user.email
```
Both must be non-empty.

### 3. Analyze Changes
- What files were changed?
- Nature of the change? (feature, bug fix, refactoring, etc.)
- Related issues?

### 4. Determine Commit Type
Select the most appropriate type for the changes

### 5. Write Commit Message
- Title: Under 50 chars, imperative mood
- Body: Explain what and why

### 6. Execute Commit
```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<body>

Co-Authored-By: AI Agent <noreply@agent.local>
EOF
)"
```

## Notes
- One logical change per commit
- Add `!` for Breaking Changes: `feat!: change API`
- Include related issue numbers in footer: `Closes #123`
- Unstaged files are not committed
