---
name: campaign-loop
description: Use to toggle hands-off campaign auto-steering — /skill:campaign-loop on|off|status
---

# Campaign Loop

Kill switch and status for Pi campaign auto-steering. The loop is driven by the
Pi extension `~/.pi/agent/extensions/campaign-loop.ts`, which approximates Claude
Code's Stop hook by injecting a follow-up user message from `agent_end` when the
loop is enabled.

**The loop is OFF by default.** It runs only while the toggle file
`~/.pi/agent/campaign-loop.active` exists.

Pi cannot literally block a Stop event the way Claude Code can. The extension
continues by sending a follow-up user message after `agent_end`. A turn already
in flight always finishes.

## Usage

`/skill:campaign-loop on|off|status`

### `on`
1. Resolve the active campaign in `$cwd`: newest `.pi/campaigns/<id>/campaign.json`
   whose `current_phase != complete`. If none exists, tell the user there is
   nothing to steer and stop.
2. Create the toggle file: `touch ~/.pi/agent/campaign-loop.active`.
3. Initialize loop-state next to the campaign at `<campaign-dir>/.loop-state` without a session owner:
   ```json
   { "iteration": 0, "max_iterations": 15,
     "last_progress_hash": "", "no_progress_count": 0 }
   ```
   `max_iterations` defaults to **15**. Accept optional override:
   `/skill:campaign-loop on max=N`. The extension claims `loop_session_id` on first `agent_end` using `ctx.sessionManager.getSessionFile() ?? "ephemeral"`.
4. Announce which campaign, current sprint `N/total`, `max_iterations`, and that
   Pi will auto-continue after each agent turn while the loop remains enabled.

### `off`
1. Remove the toggle: `rm -f ~/.pi/agent/campaign-loop.active`.
2. Announce the loop is disabled. Leave `.loop-state` in place for inspection.

### `status`
Print without changing anything:
- active campaign id, `current_phase`, `current_sprint/total_sprints`
- whether the toggle file exists (loop ON/OFF)
- `.loop-state` contents: `iteration/max_iterations`, `no_progress_count`,
  `loop_session_id`, `last_progress_hash`

Safe status snippets:
```bash
[ -f ~/.pi/agent/campaign-loop.active ] && echo ON || echo OFF
find .pi/campaigns -mindepth 2 -maxdepth 2 -name campaign.json 2>/dev/null
```

## Guardrails

The extension enforces:
- loop toggle absent -> no auto-steering
- session mismatch against `ctx.sessionManager.getSessionFile() ?? "ephemeral"` -> do not steer unrelated sessions
- `iteration >= max_iterations` -> halt
- no progress for 3 consecutive checks -> halt
- `current_phase == blocked` -> halt and surface `blocked_reason`
- completion verification -> if a `verify_command` exists, re-run it before
  treating `current_phase: complete` as safe to stop

## Notes

This skill only flips state and reports status. It does not itself drive the
loop; the Pi extension does.
