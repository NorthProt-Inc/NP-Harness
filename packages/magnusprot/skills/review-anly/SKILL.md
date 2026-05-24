---
name: review-anly
description: Use when reviewing code — 7-perspective quality analysis
metadata:
  pi:
    user-invocable: true
    argument-hint: '[file paths or git diff range]'
---

# Code Review

## Overview

Two modes: **dispatching** a review (requesting) or **performing** a review (7-perspective framework).

**Core principle:** Review early, review often. Find real bugs, not style nitpicks.

---

## Quick Mode: Pre-Commit Review

For fast review of local changes before committing. Invoke with `--quick` or no arguments.

### Steps
1. **Branch & Context:** `git branch -vv`, `git status --short`, `git stash list`, `git tag --sort=-version:refname | head -5`
2. **Diff:** `git diff` + `git diff --staged` (or specified range like `HEAD~3`, `main`, `--staged`)
3. **Read** full files for context
4. **Review** each change:
   - Correctness: logic errors, off-by-one, null handling, type mismatches
   - Security: hardcoded secrets, SQL injection, unvalidated input
   - Style: naming, consistency, unnecessary changes
   - Missing: error handling, edge cases, tests

### Quick Mode Output
```
## Change Review

### Git Context
- Branch: feature/auth (-> origin/feature/auth)
- Ahead: 2, Behind: 0
- Working tree: 3 modified, 1 staged, 2 untracked
- Stash: 2 entries
- Recent tags: v1.2.0, v1.1.0

### Summary
- Changed files: N (+A, -D)
- Review result: OK / Changes recommended

### Per-file Feedback

#### file.py (+15, -3)
- [MUST] :42 - SQL injection risk: use parameter binding
- [NIT] :58 - `d` is less clear than `data`

### Pre-commit Checklist
- [ ] Address above feedback
- [ ] Verify tests pass
- [ ] Remove debug code
```

For comprehensive code review, use Mode A (dispatch) or Mode B (7-perspective) below.

---

## Mode A: Requesting Review (Dispatch)

### When to Request

**Mandatory:**
- After each task in execute-flow
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

### How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use Pi's `Agent` tool with `subagent_type: "code-reviewer"` and the template at `code-reviewer.md` in this directory. Include the rendered template content directly in the `prompt` field; do not pass only a file path.

```js
Agent({
  subagent_type: "code-reviewer",
  description: "Review code changes: {DESCRIPTION}",
  prompt: "[Rendered code-reviewer.md template with placeholders filled, including original user request, absolute working directory, full task text or requirements, allowed scope/files, tool policy, expected report format, and stop conditions]",
  run_in_background: false,
  inherit_context: false
})
```

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

### Integration with Workflows

**execute-flow (subagent mode):**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**execute-flow (batch mode):**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

---

## Mode B: Performing Review (7-Perspective)

### Project Context Detection

Before starting, detect the project environment:

1. **READ** the current working directory structure
2. **IDENTIFY** the language, framework, and test runner
3. **CHECK** for design docs or implementation plans in `docs/plans/`
4. **CHECK** for project rules in `.claude/rules/`

### Review Protocol

1. **READ** any design docs or impl plans relevant to the files under review
2. **READ** all files listed in $ARGUMENTS (or recent git diff if no files specified)
3. **RUN** the project's test suite to verify current test status
4. **REVIEW** each file through all 7 perspectives
5. **CHECK** design doc compliance (if applicable)
6. **CHECK** TDD compliance
7. **REPORT** findings in the output format below

### 7-Perspective Code Review

Review every file through each perspective. Skip perspectives that genuinely don't apply.

#### 1. Design Quality (Most Important)
- Circular dependencies between modules?
- Single Responsibility Principle violations?
- Deep vs shallow modules -- are interfaces simpler than implementations?
- Proper separation of concerns (config vs logic vs I/O)?
- Are abstractions at the right level?

#### 2. Complexity & Readability
- Functions exceeding 80 lines?
- Files exceeding 400 lines?
- Nesting deeper than 3 levels?
- Unclear or misleading names?
- Magic numbers without explanation?

#### 3. Security
- Input validation on external data (API responses, user input)?
- Secrets or credentials hardcoded?
- Injection vulnerabilities (SQL, command, XSS)?
- Proper use of secrets/env vars for sensitive config?

#### 4. Bugs & Reliability
- Logic errors (off-by-one, wrong operator, inverted condition)?
- Race conditions in async/concurrent code (shared mutable state)?
- Resource leaks (unclosed connections, files, streams)?
- Bare exception catching swallowing errors?
- Missing error handling on I/O operations?
- Edge cases: empty input, null values, boundary conditions?

#### 5. Changeability
- Hardcoded values that should be configurable?
- Missing tests for important behaviors?
- Tight coupling between modules?
- Would changing one module force changes in many others?

#### 6. Dead Code
- Unused imports?
- Uncalled functions or methods?
- Commented-out code?
- Unreachable code paths?

#### 7. DRY Violations
- Copy-pasted logic across files?
- Duplicated constants or configuration?
- Similar functions that should be unified?

### TDD Compliance Check

- For each source file, verify a corresponding test file exists
- Tests actually test meaningful behaviors (not just "it imports")
- Tests cover edge cases and error paths, not just happy path
- No implementation code without corresponding tests

### Output Format

```
## Review Summary

Files reviewed: <list>
Tests status: PASS / FAIL (with details if fail)
Overall: APPROVE / APPROVE WITH COMMENTS / REQUEST CHANGES

## Findings

### [CRITICAL] <file_path>:<line_number> -- <title>
<description of the issue>
**Suggested fix:**
<concrete code or approach to fix>

### [HIGH] <file_path>:<line_number> -- <title>
...

### [MEDIUM] <file_path>:<line_number> -- <title>
...

### [LOW] <file_path>:<line_number> -- <title>
...

## TDD Compliance
- [ ] All source files have test files
- [ ] Tests cover important behaviors
- [ ] Tests were written first (check git log if possible)
```

### Severity Definitions

| Level | Meaning | Action Required |
|-------|---------|----------------|
| CRITICAL | Bug, security flaw, or data loss risk | Must fix before merge |
| HIGH | Design violation or reliability concern | Should fix before merge |
| MEDIUM | Code quality issue, missing test coverage | Fix in next iteration |
| LOW | Style preference, minor improvement | Optional |

### Rules

- Be **specific**: always include file paths and line numbers
- Be **constructive**: every finding MUST include a suggested fix
- Be **honest**: if the code is good, say so -- don't invent issues
- **ZERO false positives** is more important than catching every issue
- Do NOT block on LOW issues
- Do NOT rewrite code in your head -- review what's actually there
- Do NOT suggest adding features beyond current task scope

---

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback
- Say "looks good" without checking

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification
