# AI Coding Agent Anti-Patterns Catalog

Known failure modes of AI coding agents. Workers embed relevant sections from this catalog.

## Structural Over-engineering

| Pattern | Symptom | Example |
|---------|---------|---------|
| **Abstraction Bloat** | Class hierarchies, factory/strategy/registry for single use | `AbstractBaseProcessor` with one concrete subclass |
| **Scaffolding Excess** | Elaborate setup for simple operations | 7-file logging package wrapping stdlib |
| **Config Explosion** | Too many config options for simple behavior | Validation for params that are always defaults |
| **Defensive Overkill** | Guards for impossible scenarios | Semaphore for serial workload, re-init protection never triggered |

## Code Accumulation

| Pattern | Symptom | Example |
|---------|---------|---------|
| **Dead Code After Refactoring** | Old implementations left in place | Unused methods after API change |
| **Regeneration vs Reuse** | Fresh code instead of importing existing | Same helper function in 2+ files |
| **Schema/API Bloat** | DB tables, API endpoints for unimplemented features | Empty tables with indexes maintained |
| **Copy-Paste Amplification** | Duplicated blocks with minor variations | Error handling boilerplate repeated per module |

## Context Failures

| Pattern | Symptom | Example |
|---------|---------|---------|
| **Assumption Propagation** | Wrong assumption baked into architecture | Namespace column for non-existent multi-tenancy |
| **Convention Violation** | Ignoring project-specific patterns | Bypassing state machine via private attribute |
| **Hardcoded Context** | Environment-specific values scattered | Timezone in 3 files instead of config |
| **Implicit Coupling** | Hidden dependencies between modules | Double-debounce across VAD + pipeline |

## Quality Gaps

| Pattern | Symptom | Example |
|---------|---------|---------|
| **Error Handling Gaps** | Missing null checks, bare except | ~2x human rate (CodeRabbit 2025) |
| **Concurrency Misuse** | Async primitive misuse | ~2x human rate |
| **Readability Decay** | Naming inconsistency, formatting | ~3x human rate |
| **Facade-Only Wrappers** | Thin wrappers adding no capability | Logger wrapper duplicating stdlib API |

Sources: Addy Osmani (2025), CodeRabbit State of AI Code (2025), Mike Mason (2026), Stack Overflow (2026)
