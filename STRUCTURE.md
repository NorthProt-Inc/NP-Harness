# Pi Agent Structure

A human-facing map for `~/.pi/agent`.

## One-line model

```text
skills/      Workflows the agent can use
prompts/     Slash shortcuts I can type
extensions/  Code that changes Pi behavior
packages/    Bundles that can provide skills, prompts, extensions, or agents
```

## The confusing part

Both skills and prompts can appear as slash commands, but they are not the same thing.

```text
Prompt = button
Skill  = instruction manual
```

Example:

```text
/handoff prompt  -> tells the agent to use the remember workflow
remember skill   -> explains how to write .remember/remember.md
```

So `/handoff` is the human-facing command. `remember` is the reusable workflow behind it.

## Directory map

```text
~/.pi/agent/
  AGENTS.md          Global instructions loaded into Pi sessions.
  MEMORY.md          Loaded memory index, if present through the memory extension.
  STRUCTURE.md       This file.
  settings.json      Main Pi settings: models, packages, permissions, extensions.
  mcp.json           MCP server config and secrets. Do not print or commit.

  skills/            User-facing workflows/capabilities.
    remember/        Workflow for saving project handoff notes.
    pdf/             PDF workflow. Extra .md files inside are references, not separate skills.
    ...

  prompts/           Slash prompt templates.
    handoff.md       Provides /handoff. Calls the remember skill workflow.

  extensions/        Local Pi extension code.
    memory.ts        Loads memory context.
    statusline.ts    Statusline customization.
    triage.ts        Triage helpers.
    ...

  packages/          Local package-style add-ons.
    magnusprot/      Workflow skills such as plan-flow, execute-flow, verify-anly.
    pi-subagents/    Subagent extension and agent definitions.
    codex-plugin/    Codex companion integration.

  node_modules/      Installed npm packages. Usually not edited directly.
  docs/              Longer notes, implementation plans, and references.
```

## What appears in Pi startup lists

Pi startup lists show registered features, not every file on disk.

```text
[Skills]      Registered skills from skills/, packages, settings, etc.
[Prompts]     Registered prompt templates from prompts/ or exported packages.
[Extensions]  Loaded extension files or extension packages.
[Themes]      Loaded theme names.
```

If a file exists but is not registered, it will not appear in the startup list.

## Why some files are hidden from the lists

- `skills/pdf/forms.md` is a reference file used by the `pdf` skill.
- `skills/pptx/editing.md` is a reference file used by the `pptx` skill.
- `packages/codex-plugin/prompts/*.md` are internal prompt assets unless exported as `pi.prompts`.
- `packages/codex-plugin/skills/*/SKILL.md` are internal helper skills unless exported and intended for users.

## Naming rule for sanity

Avoid using the same name for a prompt and a skill.

Good:

```text
/handoff  -> human command
remember  -> workflow skill
```

Confusing:

```text
/remember -> prompt
remember  -> skill
```

## Where to add things

Add a new reusable workflow:

```text
skills/my-workflow/SKILL.md
```

Add a new slash shortcut:

```text
prompts/my-command.md
```

Add code that changes Pi itself:

```text
extensions/my-extension.ts
```

Add a bundled add-on:

```text
packages/my-package/package.json
```

## Safety notes

- Read `settings.json` before editing it.
- Do not print or commit `mcp.json`; it can contain secrets.
- Keep random notes out of `prompts/`, because every `prompts/*.md` becomes a slash command.
- Keep random root `.md` files out of `skills/`, because Pi may discover them as skills.
