#!/usr/bin/env python3
"""Static smoke checks for magnusprot Pi workflow migration."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

FORBIDDEN_IN_SKILLS = [
    "default_api:",
    "pi --eval",
    "pi list --skills",
    "mcp__plugin_context7",
    "mcp__tavily",
    "Task tool",
    "TodoWrite",
    "Claude Opus",
    "Claude Code",
]

CORE_WORKFLOW = [
    "brainstorm-flow",
    "plan-flow",
    "plancheck-flow",
    "execute-flow",
    "verify-anly",
]

EXPECTED_DESC_TERMS = {
    "brainstorm-flow": ["approved design", "planning"],
    "plan-flow": ["plancheck-flow"],
    "plancheck-flow": ["plan-flow", "execute-flow"],
    "execute-flow": ["plancheck-flow", "blockers"],
    "verify-anly": ["evidence", "scope"],
}


def fail(msg: str, failures: list[str]) -> None:
    failures.append(msg)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_json(failures: list[str]) -> None:
    for path in sorted((ROOT / "evals").glob("**/*.json")):
        try:
            json.loads(read(path))
        except Exception as exc:  # noqa: BLE001 - diagnostic script
            fail(f"invalid JSON: {path.relative_to(ROOT)}: {exc}", failures)

    for path in sorted((ROOT / "schemas").glob("*.json")):
        try:
            json.loads(read(path))
        except Exception as exc:  # noqa: BLE001 - diagnostic script
            fail(f"invalid schema JSON: {path.relative_to(ROOT)}: {exc}", failures)


def check_schema_semantics(failures: list[str]) -> None:
    campaign = json.loads(read(ROOT / "schemas/campaign.schema.json"))
    sprint = json.loads(read(ROOT / "schemas/sprint-contract.schema.json"))

    if campaign.get("$id") != "https://github.com/NorthProt-Inc/NP-Harness/schemas/campaign.schema.json":
        fail("campaign schema has wrong $id", failures)
    if campaign.get("title") != "magnusprot Pi Campaign":
        fail("campaign schema has wrong title", failures)
    for field in ["harness", "project", "current_phase", "current_sprint", "continuation_prompt"]:
        if field not in campaign.get("required", []):
            fail(f"campaign schema missing required field {field!r}", failures)

    if sprint.get("$id") != "https://github.com/NorthProt-Inc/NP-Harness/schemas/sprint-contract.schema.json":
        fail("sprint contract schema has wrong $id", failures)
    if sprint.get("title") != "magnusprot Pi Sprint Contract":
        fail("sprint contract schema has wrong title", failures)
    for field in ["sprint_id", "campaign_id", "feature", "deliverables", "success_criteria", "testable_behaviors", "scope_boundaries", "evaluation_method"]:
        if field not in sprint.get("required", []):
            fail(f"sprint contract schema missing required field {field!r}", failures)
    if "harness" in sprint.get("required", []):
        fail("sprint contract schema appears to contain campaign required fields", failures)


def check_forbidden_terms(failures: list[str]) -> None:
    targets = list((ROOT / "skills").glob("**/*.md")) + [ROOT / "README.md"]
    for path in targets:
        text = read(path)
        for term in FORBIDDEN_IN_SKILLS:
            if term in text:
                fail(f"forbidden term {term!r} in {path.relative_to(ROOT)}", failures)

    # The legacy file path .remember/remember.md is allowed, but the slash command is not.
    # This catches markdown/code-formatted commands like `/remember` while allowing paths
    # where the slash is preceded by a word character, e.g. .remember/remember.md.
    command_pattern = re.compile(r"(?<![.\w])/remember(?![/\w.])")
    for path in (ROOT / "skills").glob("**/*.md"):
        text = read(path)
        if command_pattern.search(text):
            fail(f"unsupported /remember command in {path.relative_to(ROOT)}", failures)


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = read(path)
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}
    data: dict[str, str] = {}
    for line in parts[1].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip()
    return data


def check_frontmatter(failures: list[str]) -> None:
    for path in sorted((ROOT / "skills").glob("*/SKILL.md")):
        data = parse_frontmatter(path)
        if not data:
            fail(f"missing frontmatter: {path.relative_to(ROOT)}", failures)
            continue
        expected_name = path.parent.name
        if data.get("name") != expected_name:
            fail(f"name mismatch: {path.relative_to(ROOT)} has {data.get('name')!r}", failures)
        if not data.get("description"):
            fail(f"missing description: {path.relative_to(ROOT)}", failures)

    for name in CORE_WORKFLOW:
        path = ROOT / "skills" / name / "SKILL.md"
        desc = parse_frontmatter(path).get("description", "")
        lower = desc.lower()
        for term in EXPECTED_DESC_TERMS[name]:
            if term.lower() not in lower:
                fail(f"description for {name} missing expected term {term!r}", failures)


def check_agent_schema_refs(failures: list[str]) -> None:
    required_files = [
        ROOT / "skills/brainstorm-flow/spec-reviewer-prompt.md",
        ROOT / "skills/plancheck-flow/SKILL.md",
        ROOT / "skills/execute-flow/implement-prompt.md",
        ROOT / "skills/execute-flow/spec-reviewer-prompt.md",
        ROOT / "skills/execute-flow/code-quality-reviewer-prompt.md",
        ROOT / "skills/execute-flow/evaluator-prompt.md",
        ROOT / "skills/review-anly/SKILL.md",
    ]
    required_prompt_terms = [
        "original user request",
        "absolute",
        "allowed scope",
        "tool policy",
        "stop condition",
    ]
    for path in required_files:
        text = read(path)
        lower = text.lower()
        for token in ["Agent({", "subagent_type", "description", "prompt", "run_in_background"]:
            if token not in text:
                fail(f"missing Agent schema token {token!r} in {path.relative_to(ROOT)}", failures)
        for term in required_prompt_terms:
            if term not in lower:
                fail(f"Agent prompt in {path.relative_to(ROOT)} missing required content {term!r}", failures)

    dispatch_eval = json.loads(read(ROOT / "evals/dispatch/evals.json"))
    for item in dispatch_eval.get("items", []):
        for term in item.get("required_prompt_content", []):
            if not any(term.lower() in read(path).lower() for path in required_files):
                fail(f"dispatch eval required prompt content not represented in templates: {term!r}", failures)


def main() -> int:
    failures: list[str] = []
    check_json(failures)
    check_schema_semantics(failures)
    check_forbidden_terms(failures)
    check_frontmatter(failures)
    check_agent_schema_refs(failures)

    if failures:
        print("Static check failed:")
        for item in failures:
            print(f"- {item}")
        return 1

    print("Static check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
