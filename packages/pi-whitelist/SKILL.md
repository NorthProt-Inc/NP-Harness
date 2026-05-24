---
name: pi-whitelist
description: "Tool permission system for pi-coding-agent. Use when configuring, checking, or managing tool permissions (allow/deny/ask) for AI agent tool invocations."
---

# pi-whitelist

Tri-state tool permission system (allow/deny/ask) for AI agent tool invocations.

## Quick Start

```typescript
import { PermissionManager } from '@0xkobold/pi-whitelist'

const manager = new PermissionManager()

// Check a tool invocation
const decision = manager.check({ toolName: 'Bash', ruleContent: 'git status' })
// decision.behavior === 'allow' | 'deny' | 'ask'

// Add a persistent rule (2 = always allow)
manager.addRule({ toolName: 'Bash', ruleContent: 'git *' }, 'allow', 'projectSettings')

// Three-state UI mapping:
// 1 = Allow once     → decision.behavior === 'allow' (no persistence)
// 2 = Allow always   → manager.addRule(...) + 'allow'
// 3 = Deny           → decision.behavior === 'deny'
```

## Key Exports

- `PermissionManager` — Main class with check, addRule, removeRule
- `checkPermission` — Standalone function for one-shot checks
- `parseRuleString` / `serializeRuleString` — Rule format parsing
- `GlobMatcher`, `CommandMatcher`, `FileMatcher` — Pattern matchers
- `MemorySettingsStore`, `FileSettingsStore` — Storage backends
- Types: `PermissionBehavior`, `PermissionDecision`, `PermissionRule`, etc.

## Rule Format

`ToolName` or `ToolName(content)` with glob patterns:

- `Bash` — matches any Bash invocation
- `Bash(git *)` — matches git commands
- `FileEdit(/src/**)` — matches file edits under /src/
- `Read` — matches the Read tool

## Permission Modes

`pi-whitelist` supports four main interactive modes to control the behavior of tool execution checks:

- `default` — Neutrally evaluates explicit rules, prompts on unknown or dangerous actions, auto-allows read-only tools.
- `auto` — Auto-approves all safe tool executions without prompt. Normal deny rules and dangerous command overrides are still active and will block/prompt.
- `plan` — Non-interactive safe planning mode. Blocks edits, writes, subagents, and unknown custom tools without fallback. Allows known read-only tools and safe read-only Bash commands.
- `bypass` — Bypasses normal rules, but maintains a critical root/home destructive circuit breaker.

### Swapping Modes

Use the command interface or keyboard shortcut inside the session:
- **Shortcut:** `ctrl+shift+m` cycles through `default → auto → plan → bypass → default`.
- `/whitelist mode` - Reports current mode status.
- `/whitelist mode <mode>` - Changes mode for the session.
- `/whitelist mode <mode> --save` - Persists the mode as your user-level default (stored in global user settings).