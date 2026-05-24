# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```js
Agent({
  subagent_type: "code-reviewer",
  description: "Review code quality for Task N",
  prompt: `Render and include the full review-anly/code-reviewer.md template content here with placeholders filled. Do not pass only a file path.

  Original user request: [paste original request or approved design summary]
  Absolute working directory: [ABSOLUTE_PROJECT_ROOT]
  WHAT_WAS_IMPLEMENTED: [from implement's report]
  PLAN_OR_REQUIREMENTS: [full task text for Task N and acceptance criteria, not just plan-file path]
  Allowed scope and files: [files/directories this task was allowed to modify]
  Tool policy: Read-only review. Inspect files and diffs; do not edit or commit.
  Stop conditions: Stop and report if the diff range is invalid, task text is incomplete, or required files are missing.
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
  DESCRIPTION: [task summary]`,
  run_in_background: false,
  inherit_context: false
})
```

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment
