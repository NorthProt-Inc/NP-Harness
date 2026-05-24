import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanCatalog } from "../src/catalog.js";
import {
  detectManifestDrift,
  detectUnmanagedTargetConflicts,
  loadManifest,
  manifestPathForProject,
  writeManifest,
} from "../src/manifest.js";
import { loadProjectState, projectSettingsPathForRoot } from "../src/project-state.js";
import type { KitsManifest } from "../src/types.js";

async function createTempProject(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), "pi-kits-project-"));
}

function sampleManifest(projectRoot: string, catalogRoot: string): KitsManifest {
  return {
    schemaVersion: 1,
    entries: [
      {
        key: "prompt:ui-review",
        type: "prompt",
        label: "ui-review",
        installMode: "copy",
        sourcePath: path.join(catalogRoot, "prompts", "ui-review.md"),
        targetPaths: [path.join(projectRoot, ".pi", "prompts", "ui-review.md")],
        settingsChanges: [],
        installedAt: "2026-05-24T00:00:00.000Z",
        catalogFingerprint: "a".repeat(64),
      },
      {
        key: "extension:package-preview",
        type: "extension",
        label: "package-preview",
        installMode: "reference",
        sourcePath: path.join(catalogRoot, "extensions", "package-preview"),
        targetPaths: [],
        settingsChanges: [
          {
            type: "extension-reference",
            path: ".pi/settings.json",
            value: path.join(catalogRoot, "extensions", "package-preview"),
          },
        ],
        installedAt: "2026-05-24T00:00:00.000Z",
        catalogFingerprint: "b".repeat(64),
        notes: "Package extensions are referenced by directory in MVP.",
      },
    ],
  };
}

describe("manifest persistence", () => {
  it("loads a missing manifest as an empty schema version 1 manifest", async () => {
    const projectRoot = await createTempProject();

    await expect(loadManifest(manifestPathForProject(projectRoot))).resolves.toEqual({
      schemaVersion: 1,
      entries: [],
    });
  });

  it("writes and reads manifest entries with ownership metadata", async () => {
    const projectRoot = await createTempProject();
    const catalogRoot = path.join(projectRoot, "catalog");
    const manifest = sampleManifest(projectRoot, catalogRoot);

    await writeManifest(manifestPathForProject(projectRoot), manifest);

    await expect(loadManifest(manifestPathForProject(projectRoot))).resolves.toEqual(manifest);
  });

  it("throws an explicit error for invalid manifest JSON", async () => {
    const projectRoot = await createTempProject();
    const manifestPath = manifestPathForProject(projectRoot);
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, "{broken json");

    await expect(loadManifest(manifestPath)).rejects.toThrow(/Invalid kits manifest JSON/);
  });

  it("throws an explicit error for malformed manifest entry structure", async () => {
    const projectRoot = await createTempProject();
    const manifestPath = manifestPathForProject(projectRoot);
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      schemaVersion: 1,
      entries: [
        {
          key: "prompt:ui-review",
          type: "prompt",
          label: "ui-review",
          installMode: "copy",
          sourcePath: "/catalog/prompts/ui-review.md",
          targetPaths: ["/project/.pi/prompts/ui-review.md"],
          settingsChanges: { type: "extension-reference" },
          installedAt: "2026-05-24T00:00:00.000Z",
          catalogFingerprint: "a".repeat(64),
        },
      ],
    }));

    await expect(loadManifest(manifestPath)).rejects.toThrow(/invalid manifest entry/);
  });
});

describe("project settings state", () => {
  it("loads missing project settings as an empty settings object", async () => {
    const projectRoot = await createTempProject();

    await expect(loadProjectState(projectRoot)).resolves.toMatchObject({
      projectRoot,
      settingsPath: projectSettingsPathForRoot(projectRoot),
      settingsExists: false,
      extensions: [],
    });
  });

  it("throws an explicit error for invalid project settings JSON", async () => {
    const projectRoot = await createTempProject();
    const settingsPath = projectSettingsPathForRoot(projectRoot);
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, "{broken json");

    await expect(loadProjectState(projectRoot)).rejects.toThrow(/Invalid project settings JSON/);
  });

  it("throws an explicit error when project settings extensions is not an array of strings", async () => {
    const projectRoot = await createTempProject();
    const settingsPath = projectSettingsPathForRoot(projectRoot);
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({ extensions: ["/ok", 42] }));

    await expect(loadProjectState(projectRoot)).rejects.toThrow(/extensions must be an array of strings/);
  });
});

describe("drift and conflict checks", () => {
  it("reports missing managed targets, missing settings references, and missing catalog sources", async () => {
    const projectRoot = await createTempProject();
    const catalogRoot = path.join(projectRoot, "catalog");
    await mkdir(path.join(catalogRoot, "prompts"), { recursive: true });
    await writeFile(path.join(catalogRoot, "prompts", "ui-review.md"), "Review this UI.\n");
    const catalog = await scanCatalog(catalogRoot);
    const manifest = sampleManifest(projectRoot, catalogRoot);
    const projectState = await loadProjectState(projectRoot);

    const drift = await detectManifestDrift(manifest, catalog, projectState);

    expect(drift).toContainEqual(expect.objectContaining({
      code: "managed-target-missing",
      key: "prompt:ui-review",
      path: path.join(projectRoot, ".pi", "prompts", "ui-review.md"),
    }));
    expect(drift).toContainEqual(expect.objectContaining({
      code: "settings-reference-missing",
      key: "extension:package-preview",
      path: ".pi/settings.json",
      value: path.join(catalogRoot, "extensions", "package-preview"),
    }));
    expect(drift).toContainEqual(expect.objectContaining({
      code: "catalog-source-missing",
      key: "extension:package-preview",
      path: path.join(catalogRoot, "extensions", "package-preview"),
    }));
  });

  it("detects existing unmanaged target paths before apply", async () => {
    const projectRoot = await createTempProject();
    const targetPath = path.join(projectRoot, ".pi", "prompts", "ui-review.md");
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, "existing unmanaged prompt\n");

    const conflicts = await detectUnmanagedTargetConflicts(
      [targetPath],
      { schemaVersion: 1, entries: [] },
    );

    expect(conflicts).toEqual([
      expect.objectContaining({
        code: "unmanaged-target-exists",
        path: targetPath,
      }),
    ]);
  });

  it("does not flag existing targets already owned by the manifest", async () => {
    const projectRoot = await createTempProject();
    const catalogRoot = path.join(projectRoot, "catalog");
    const targetPath = path.join(projectRoot, ".pi", "prompts", "ui-review.md");
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, "managed prompt\n");

    const conflicts = await detectUnmanagedTargetConflicts(
      [targetPath],
      sampleManifest(projectRoot, catalogRoot),
    );

    expect(conflicts).toEqual([]);
  });
});
