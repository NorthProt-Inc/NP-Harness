# magnusprot Workflow Smoke Evals

These are lightweight smoke-test seeds for the Pi workflow migration. They are not a full eval harness.

## Contents

- `trigger/evals.json` — prompts that should activate the right workflow skill
- `chain/evals.json` — expected high-level workflow sequence
- `state/evals.json` — campaign resume/migration scenarios
- `dispatch/evals.json` — Pi `Agent({...})` dispatch schema checks
- `scripts/check_static.py` — model-free static checker

## Static Check

```bash
python3 evals/scripts/check_static.py
```

## Manual Smoke Protocol

1. Open Pi in this repo.
2. Run `/reload`.
3. Try one prompt from each eval file.
4. Confirm the observed skill/sequence roughly matches the expected behavior.
5. Keep runtime transcripts local unless intentionally adding fixtures.

Pi currently has no documented `pi --eval` command, so these JSON files are prompt sets and documentation, not an automated model-eval runner.
