import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatApplySummary, formatStatusReport } from "../src/format.js";
import type { KitsStatusPaths } from "../src/types.js";

function samplePaths(projectRoot: string): KitsStatusPaths {
  return {
    catalogRoot: path.join(projectRoot, "catalog"),
    projectRoot,
    projectPiDir: path.join(projectRoot, ".pi"),
    projectSettingsPath: path.join(projectRoot, ".pi", "settings.json"),
    manifestPath: path.join(projectRoot, ".pi", "kits.json"),
  };
}

describe("formatApplySummary", () => {
  it("reports changed resources and tells the user to reload", () => {
    expect(formatApplySummary({ added: ["prompt:ui-review"], removed: ["skill:old"], skipped: [] })).toBe([
      "Pi Kits apply complete: added 1, removed 1, skipped 0.",
      "Run /reload to load changed skills, prompts, and extensions.",
    ].join("\n"));
  });

  it("includes skipped resources", () => {
    expect(formatApplySummary({ added: [], removed: [], skipped: ["prompt:blocked"] })).toContain("Skipped: prompt:blocked");
  });
});

describe("formatStatusReport", () => {
  it("lists catalog resources, managed resources, drift warnings, and catalog warnings", () => {
    const projectRoot = "/tmp/pi-kits-format-project";
    const report = formatStatusReport({
      paths: samplePaths(projectRoot),
      resources: [
        {
          key: "prompt:ui-review",
          type: "prompt",
          name: "ui-review",
          label: "ui-review",
          sourcePath: "/catalog/prompts/ui-review.md",
          entryPath: "/catalog/prompts/ui-review.md",
          fingerprint: "a".repeat(64),
          installMode: "copy",
        },
      ],
      manifest: {
        schemaVersion: 1,
        entries: [
          {
            key: "prompt:ui-review",
            type: "prompt",
            label: "ui-review",
            installMode: "copy",
            sourcePath: "/catalog/prompts/ui-review.md",
            targetPaths: [path.join(projectRoot, ".pi", "prompts", "ui-review.md")],
            settingsChanges: [],
            installedAt: "2026-05-24T00:00:00.000Z",
            catalogFingerprint: "a".repeat(64),
          },
        ],
      },
      catalogWarnings: [{ code: "invalid-prompt", message: "bad prompt", path: "/catalog/prompts/bad.md" }],
      driftIssues: [{ code: "managed-target-missing", message: "missing", path: "/project/.pi/prompts/ui-review.md" }],
    });

    expect(report).toContain("Catalog resources: 1");
    expect(report).toContain("Managed resources: 1");
    expect(report).toContain("managed-target-missing");
    expect(report).toContain("invalid-prompt");
  });
});
