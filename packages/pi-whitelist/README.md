# pi-whitelist

> Tri-state tool permission system (allow/deny/ask) for AI agent tool invocations

A standalone, runtime-agnostic npm module for controlling AI agent tool invocations.

## Why?

Every AI agent that executes tools needs permission gating. Without it, agents can run destructive commands without oversight. `pi-whitelist` gives you a simple, battle-tested model:

| # | Action | Behavior |
|---|---|---|
| 1 | **Allow once** | Let it run this time, don't persist |
| 2 | **Allow always** | Save a rule, auto-approve future matches |
| 3 | **Deny** | Block the invocation |

Every check returns one of three decisions: `allow`, `deny`, or `ask`. No booleans, no ambiguity.

## Install

```bash
npm install @0xkobold/pi-whitelist
```

## Quick Start

```typescript
import { PermissionManager } from '@0xkobold/pi-whitelist'

const manager = new PermissionManager()

// Read-only tools are auto-allowed
manager.check({ toolName: 'Read' })
// → { behavior: 'allow', decisionReason: { type: 'other', reason: 'read-only-tool' } }

// Destructive tools require approval
manager.check({ toolName: 'Bash', ruleContent: 'docker build .' })
// → { behavior: 'ask', message: 'Bash: docker build .', suggestions: [...] }

// Add an "allow always" rule
manager.addRule({ toolName: 'Bash', ruleContent: 'git *' }, 'allow', 'session')
manager.check({ toolName: 'Bash', ruleContent: 'git status' })
// → { behavior: 'allow', decisionReason: { type: 'rule', rule: ... } }

// Add a deny rule — deny always wins over allow for the same pattern
manager.addRule({ toolName: 'Bash', ruleContent: 'rm -rf *' }, 'deny', 'session')
manager.check({ toolName: 'Bash', ruleContent: 'rm -rf /tmp' })
// → { behavior: 'deny', message: 'Permission denied for Bash: rm -rf /tmp', ... }
```

## Three-State UI Integration

```typescript
const decision = manager.check({ toolName: 'Bash', ruleContent: 'docker build -t myapp .' })

if (decision.behavior === 'ask') {
  // Show the prompt:
  // ┌──────────────────────────────────────────────┐
  // │  Bash: docker build -t myapp .                │
  // │                                                │
  // │  1. Allow          (allow this once)           │
  // │  2. Allow always   (add rule to settings)      │
  // │  3. Deny           (block this invocation)     │
  // └──────────────────────────────────────────────┘
  const userChoice = await showPermissionPrompt(decision)

  if (userChoice === 1) {
    // Allow once — no persistence
    return { behavior: 'allow', decisionReason: { type: 'other', reason: 'user-allow-once' } }
  }
  if (userChoice === 2) {
    // Allow always — persist the rule
    manager.addRule(
      { toolName: 'Bash', ruleContent: 'docker *' },
      'allow',
      'projectSettings', // persists to .pi/settings.json
    )
  }
  if (userChoice === 3) {
    // Deny
    return { behavior: 'deny', message: decision.message, ... }
  }
}
```

## Rule Format

Rules use the format `ToolName` or `ToolName(content)` with glob patterns:

| Rule | Matches |
|---|---|
| `Bash` | Any Bash invocation |
| `Bash(git *)` | Any command starting with `git ` |
| `Bash(npm test)` | Exactly `npm test` |
| `FileEdit(/src/**)` | Any file edit under `/src/` |
| `Read` | The Read tool (no content filter) |
| `Bash(python -c "print\(1\)")` | Commands with escaped parentheses |

## Permission Modes

| Mode | Behavior | Display Label |
|---|---|---|
| `default` | Standard interactive mode: evaluates explicit rules, prompts for destructive tools, auto-allows read-only tools. | `mode default` |
| `auto` | Auto-approve mode: evaluates explicit deny rules and dangerous command overrides first, then auto-approves all other safe tool calls without prompting. | `mode auto` |
| `plan` | Non-interactive analysis mode: fails closed; allows only known read-only tools and a hardened subset of Bash commands without prompt. Explicitly blocks edits, writes, subagent delegation, and unknown custom tools without fallback. | `mode plan` |
| `bypassPermissions` | Full bypass: skips ordinary rule evaluation but maintains a critical root/home destructive command circuit breaker. (Alias: `bypass`) | `mode bypass` |
| `acceptEdits` | Legacy mode: auto-allows file edits/writes, asks for other destructive tools. | `mode acceptEdits` |
| `dontAsk` | Legacy mode: auto-approves everything not explicitly denied. | `mode dontAsk` |

```typescript
const ci = new PermissionManager({ mode: 'bypassPermissions' })
ci.check({ toolName: 'Bash', ruleContent: 'rm -rf /' })
// → { behavior: 'allow', decisionReason: { type: 'mode', mode: 'bypassPermissions' } }
```

### Cycling and the Whitelist Footer

The extension registers `ctrl+shift+m` to cycle through the primary active modes in the following loop:
```
default → auto → plan → bypass → default
```

Changes are session-only unless saved permanently. You can also view and switch modes using the command interface:
```bash
/whitelist mode               # Show current mode and cycle
/whitelist mode auto          # Change to auto mode for this session
/whitelist mode auto --save   # Persist auto mode as your user default
/whitelist mode cycle         # Advance to the next cycle mode
```
*(Note: `--save` modifies `permissions.defaultMode` in your global user settings, which can still be overridden by project-specific or local configurations on startup.)*

### Rollback & Resetting Saved Modes

If you have persisted a permission mode (such as `auto` or `bypass`) using `--save` and wish to revert to standard default behavior, simply run:
```bash
/whitelist mode default --save
```
This resets the saved `permissions.defaultMode` to `default` in your global settings, restoring prompts for any unapproved, destructive actions on relaunch.

To completely reset all local changes and fallback to the upstream package, revert the package path in your `~/.pi/agent/settings.json` from:
```json
"~/.pi/agent/packages/pi-whitelist"
```
back to:
```json
"~/.pi/agent/node_modules/@0xkobold/pi-whitelist"
```

## Rule Sources & Priority

Rules come from multiple sources, merged by priority (lowest → highest):

| Source | File | Priority |
|---|---|---|
| `userSettings` | `~/.pi/agent/settings.json` | 0 (lowest) |
| `projectSettings` | `.pi/settings.json` | 1 |
| `localSettings` | `.pi/settings.local.json` | 2 |
| `flagSettings` | CLI flags | 3 |
| `policySettings` | Enterprise/org policy | 4 |
| `cliArg` | `--allowedTools` | 5 |
| `command` | `/command` in session | 6 |
| `session` | In-memory only | 7 (highest) |

**Deny always wins over allow** when both match the same tool+content.

## Settings File

`.pi/settings.json`:
```json
{
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "Bash(git *)",
      "Bash(npm test)",
      "FileEdit(/src/**)",
      "Read"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(sudo *)"
    ],
    "ask": [
      "Bash(docker *)"
    ],
    "additionalDirectories": []
  }
}
```

## API Reference

### `PermissionManager`

The main class. Holds rules, resolves checks, persists changes.

```typescript
const manager = new PermissionManager({
  store?: SettingsStore,              // Storage backend (default: MemorySettingsStore)
  mode?: PermissionMode,              // 'default' | 'bypassPermissions' | 'plan' | 'acceptEdits' | 'dontAsk'
  additionalWorkingDirectories?: Map<string, WorkingDirectorySource>,
  isBypassPermissionsModeAvailable?: boolean,
  shouldAvoidPermissionPrompts?: boolean,
})
```

| Method | Description |
|---|---|
| `check(input)` | Evaluate a tool invocation against all rules |
| `addRule(rule, behavior, source)` | Add a rule and persist it |
| `removeRule(rule, behavior, source)` | Remove a matching rule |
| `setMode(mode)` | Switch permission mode |
| `applyUpdates(updates)` | Batch-apply permission updates |
| `isBashAllowed(command)` | Convenience: check if Bash command is allowed |
| `isFileEditAllowed(path)` | Convenience: check if file path edit is allowed |
| `getRulesForTool(toolName)` | Get all rules for a specific tool |
| `getRulesFromSource(source)` | Get all rules from a specific source |
| `getContext()` | Get the full permission context snapshot |
| `invalidateCache()` | Clear the rule evaluation cache |

### `checkPermission(input)`

Standalone one-shot check with default settings:

```typescript
import { checkPermission } from '@0xkobold/pi-whitelist'

const decision = checkPermission({ toolName: 'Read' })
// → { behavior: 'allow', ... }
```

### Matchers

| Matcher | For | Behavior |
|---|---|---|
| `GlobMatcher` | Default fallback | Uses `picomatch` for glob matching |
| `CommandMatcher` | `Bash`, `PowerShell` | Splits on `&&`, `\|\|`, `;`, `\|` and checks prefix |
| `FileMatcher` | `FileEdit`, `FileWrite` | Normalizes paths to POSIX, uses `picomatch` |

### Storage

| Store | Use |
|---|---|
| `MemorySettingsStore` | Testing, ephemeral sessions |
| `FileSettingsStore` | Persistent settings in `.pi/settings.json` |

```typescript
import { MemorySettingsStore, FileSettingsStore, mergeSettings } from '@0xkobold/pi-whitelist'

const mem = new MemorySettingsStore({ permissions: { allow: ['Bash(git *)'], deny: [], ask: [], additionalDirectories: [] } })
const file = new FileSettingsStore('.pi/settings.json')
await file.load()
```

### Read-Only Tools

These tools auto-allow in `default` mode without prompting:

`Read`, `FileRead`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `TaskGet`, `TaskList`, `TaskOutput`, `ListMcpResources`, `ReadMcpResource`, `ToolSearch`, `LSP`, `AskUser`

### Error Classes

| Error | Code | When |
|---|---|---|
| `PermissionError` | Various | Base error class |
| `RuleParseError` | `RULE_PARSE_ERROR` | Malformed rule string |
| `StorageError` | `STORAGE_ERROR` | File read/write failure |
| `MatcherError` | `MATCHER_ERROR` | Glob/command matching failure |

## Subpath Exports

```typescript
import { parseRuleString, serializeRuleString } from '@0xkobold/pi-whitelist/rules'
import { GlobMatcher, CommandMatcher, FileMatcher } from '@0xkobold/pi-whitelist/matchers'
import { MemorySettingsStore, FileSettingsStore, mergeSettings } from '@0xkobold/pi-whitelist/storage'
import type { PermissionDecision, PermissionRule, PermissionMode } from '@0xkobold/pi-whitelist/types'
```

## Test

```bash
npm test        # Run all tests
npm run build   # Compile TypeScript
```

97 tests across 9 suites covering parser, matchers, storage, merge, errors, readonly, constants, manager, and check.

## License

MIT