---
description: Save a concise project handoff note
---
Use the `remember` skill workflow now.

Human model:
- `/handoff` is the slash command the user typed.
- `remember` is the skill/workflow that writes the handoff file.

Write a handoff note so the next session can continue cleanly. Use your knowledge of the current session. Write in first person when appropriate.

Path: `{project_root}/.remember/remember.md` at the project root. Overwrite it. If the file exists, read it first if the active tool requires read-before-write.

Format:

# Handoff

## State
What's done, what's not. Files, MRs, decisions. 2-4 lines max.

## Next
What to pick up. Priority order. 1-3 items.

## Context
Non-obvious gotchas, blockers, preferences from this session. Skip if nothing.

Rules:
- Under 20 lines total.
- Specific: file paths, MR numbers, branch names.
- Forward-looking.
- If nothing meaningful to hand off, write: "No active work."
- Say "Saved." when done and nothing else.
