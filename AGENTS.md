# Global Rules for pi

These rules apply to every pi session, in every working directory.

## Conduct

1. **English-only artifacts.** All written outputs (code comments, memory entries,
   skills, docs, config files) MUST be in English unless the user explicitly requests another language. Conversational replies may match the user's language.
2. **State verification before edits.** Before modifying any config or state-reflecting file
   (settings.json, AGENTS.md, memory files, campaign state, etc.), ALWAYS read the source-of-truth first. Never edit from memory or assumption.
3. **Instruction completeness.** When a user instruction has multiple parts (disable X,
   enable Y, remove Z), verify ALL parts are addressed before submitting the edit.
4. **Debug protocol.** When a build/run/test fails, check workspace root, launch configs,
   and environment BEFORE blaming caches, reinstalling, or clearing state.
5. **Sub-agent delegation.** For multi-step or parallel tasks, proactively use sub-agents
   instead of doing everything sequentially in main context. User should not have to manually redirect.
6. **"업데이트" disambiguation.** "업데이트" means system package updates (apt/flatpak/snap),
   NOT memory/TODO/AGENTS.md updates. When ambiguous, confirm before acting.
7. **Browser-agent timeout.** If a browser agent (Playwright, Chrome DevTools) loops without progress
   for >2 minutes, abort and fall back to code-based verification (curl, reading source, API calls).
8. **Git pre-flight.** Before `git push`, verify `git config user.name` and `git config user.email`
   are set. Before `git commit`, run the project's typecheck/linter if configured. Do not commit with type errors or push with empty identity.
9. **Scope discipline.** For direct factual questions, answer with minimal tool calls (ideally 0–2).
   Do not launch deep investigations, spawn subagents, or read many files unless the user explicitly asks to diagnose or fix. If unclear, ask first.
10. **sudo — just run it.** Do not pause to ask permission, suggest the user type `!sudo …` themselves,
    or propose user-level workarounds preemptively. Execute sudo directly; if it fails or hangs on a password prompt, then fall back.

## Pi-Specific Addenda

- **MCP secrets.** `~/.pi/agent/mcp.json` holds plaintext API keys and the cyan-assistant
  `ENCRYPTION_KEY`. Never inline these values into commits, plans, or chat output. The file is gitignored (`.gitignore` in `~/.pi/agent/`).
- **`claude -p` dependency.** Two skills shell out to Claude Code's CLI: `skills/mcp-builder/`
  and `skills/skill-creator/`. They require `claude` to be on PATH. Pi and Claude Code installations remain independent; do not assume one implies the other.
- **Project handoff convention.** Long-running work uses `.remember/remember.md` in the project root
  (see the `remember` skill). Campaign state goes to `.pi/campaigns/<id>/` per `plan-flow`.

## Pointers

- User profile, projects, references, feedback: `memory/MEMORY.md` (auto-loaded each session).
- Skills index: `skills/` (built-in 15 incl. `find-skills`) + `packages/magnusprot/skills/`
  (workflow skills) + `packages/pi-subagents/` (subagent definitions) + `packages/codex-plugin/agents/` (codex-rescue).
- Out-of-scope for any pi session unless asked: `~/.claude/` — that's Claude Code's territory.
