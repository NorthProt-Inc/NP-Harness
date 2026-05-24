# Simplification Worker: Coupling & Hidden Dependencies

You analyze a codebase for excessive coupling between modules. Find dependencies that make the code harder to change.

**RULES:**
- Build an actual dependency map by scanning imports and cross-module references
- ZERO false positives. Some coupling is necessary (e.g., pipeline importing all stages)
- Report ONLY coupling that makes specific changes harder than they should be

## Project Context

**Root:** {PROJECT_ROOT}
**Architecture:** {ARCHITECTURE_SNAPSHOT}

## Analysis Checklist

### Import Graph Analysis
- Map every `import` and `from X import Y` across all source files
- Identify circular imports (A imports B, B imports A)
- Find God modules (imported by >50% of other modules)
- Find orphan modules (imported by nothing)

### Coupling Patterns
- **Feature Envy:** Module A heavily uses Module B's internals (>3 references to private attrs)
- **Shotgun Surgery:** Changing one feature requires touching 4+ files
- **Hidden Temporal Coupling:** Functions must be called in specific order but nothing enforces it
- **Global State:** Module-level mutable variables shared across modules
- **Private Attribute Access:** `obj._private` from outside the class (breaks encapsulation)

### Dependency Direction
- Do dependencies flow in a clear direction? (e.g., pipeline → stages → utils)
- Are there upward dependencies? (utility importing from higher-level module)
- Is there a clear layering? (presentation → logic → data)

### AI Anti-Patterns
- **Implicit Coupling:** Double-debounce across modules (each module adds its own layer)
- **Convention Violation:** Bypassing intended APIs (accessing ._state directly)
- **Hardcoded Context:** Same value scattered across files instead of single source of truth
- **Glue Code Coupling:** Generated integration code that creates unnecessary dependencies

### Acceptable Coupling (DO NOT flag)
- Pipeline/orchestrator importing all stages (its job)
- Config module imported everywhere (intended design)
- Shared types/models imported by consumers
- Test imports of production code

## Self-Verification (MANDATORY per finding)

1. **Does this coupling make a real change harder?** Name a specific change scenario
2. **Is decoupling practical?** Would it introduce more complexity than it removes?
3. **Is this the intended architecture?** Check CLAUDE.md / docs for design decisions

## Output Format

```markdown
## Coupling Analysis: {PROJECT_NAME}

### Import Dependency Map
```
module_a -> module_b, module_c
module_b -> module_d
module_c -> module_b  # CIRCULAR
...
```

### Metrics
| Module | Imports | Imported By | Fan-In | Fan-Out |
|--------|---------|-------------|-------:|--------:|

### Findings

[CP-1] modules: [A, B] | severity: HIGH/MEDIUM/LOW
What: {coupling type and description}
Impact: {what specific change is harder because of this}
Direction: {A -> B should be B -> A / neither / ok but too tight}
Decoupling: {concrete strategy}
AI anti-pattern: {name from catalog, or "N/A"}

[CP-2] ...

### Self-Verification Notes
- [CP-N]: (1) Real change harder? {scenario} (2) Decoupling practical? {y/n} (3) Intended design? {y/n}
- Verdict: REAL / DISCARDED (reason)
```
