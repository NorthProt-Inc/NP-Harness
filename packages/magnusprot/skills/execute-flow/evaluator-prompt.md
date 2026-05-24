# Evaluator Dispatch Prompt Template

Use this template when dispatching the evaluator agent after a sprint's tasks pass spec and quality review.

## Prompt

```js
Agent({
  subagent_type: "evaluator",
  description: "Evaluate sprint against live app",
  prompt: `You are the Evaluator agent. Your job is to black-box test the live application against the sprint contract.

## Original User Request

{PASTE ORIGINAL USER REQUEST OR APPROVED DESIGN SUMMARY HERE}

## Working Directory

Absolute path: {ABSOLUTE_PROJECT_ROOT}

## Sprint Contract

{PASTE FULL SPRINT CONTRACT JSON HERE}

## Dev Server

URL: {DEV_SERVER_URL}

## Pre-existing State

{DESCRIBE any setup needed: test accounts, seeded data, navigation path to the feature}

## Allowed Scope and Tool Policy

Black-box evaluation only. Use Playwright/browser tools against the supplied URL. Do not read source code, edit files, or commit.

## Stop Conditions

Stop and report immediately if the URL is unreachable, required credentials/test data are missing, or the sprint contract is incomplete.

## Instructions

1. Navigate to the dev server URL
2. Follow your 4-phase testing protocol (happy path → edge cases → mobile → regression)
3. Test each success criterion and testable behavior from the contract
4. Return your structured Evaluator Report with PASS/FAIL verdict

If the URL is unreachable, report immediately and stop.`,
  run_in_background: false,
  inherit_context: false
})
```

## Dispatch Notes

- **Always paste** the full sprint contract JSON into the prompt — do not make the evaluator read files
- **Always provide** the dev server URL — the evaluator cannot start servers
- **Pre-existing state**: If the feature requires login, test data, or navigation to a specific page, describe the setup
- **Background dispatch**: Consider running the evaluator in the background if you have other independent work
