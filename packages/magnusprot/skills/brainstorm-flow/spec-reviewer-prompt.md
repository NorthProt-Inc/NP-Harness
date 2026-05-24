# Spec Document Reviewer Prompt Template

Use this template when dispatching a spec document reviewer subagent.

**Purpose:** Verify the spec is complete, consistent, and ready for implementation planning.

**Dispatch after:** Design doc is written to `docs/plans/`

```js
Agent({
  subagent_type: "general-purpose",
  description: "Review spec document",
  prompt: `You are a spec document reviewer. Verify this spec is complete and ready for planning.

    ## Original User Request

    [Paste the original user request]

    ## Working Directory

    Absolute path: [ABSOLUTE_PROJECT_ROOT]

    ## Spec to Review

    [Paste the full spec document text here; do not pass only a file path]

    ## Allowed Scope and Tool Policy

    Read-only review. Inspect relevant docs/files if needed, but do not edit or commit.

    ## Stop Conditions

    Stop and report if the spec text is missing, internally incomplete, or cannot be evaluated from the provided context.

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, placeholders, "TBD", incomplete sections |
    | Consistency | Internal contradictions, conflicting requirements |
    | Clarity | Requirements ambiguous enough to cause someone to build the wrong thing |
    | Scope | Focused enough for a single plan — not covering multiple independent subsystems |
    | YAGNI | Unrequested features, over-engineering |

    ## Calibration

    **Only flag issues that would cause real problems during implementation planning.**
    A missing section, a contradiction, or a requirement so ambiguous it could be
    interpreted two different ways — those are issues. Minor wording improvements,
    stylistic preferences, and "sections less detailed than others" are not.

    Approve unless there are serious gaps that would lead to a flawed plan.

    ## Output Format

    ## Spec Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Section X]: [specific issue] - [why it matters for planning]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]`,
  run_in_background: false,
  inherit_context: false
})
```

**Reviewer returns:** Status, Issues (if any), Recommendations
