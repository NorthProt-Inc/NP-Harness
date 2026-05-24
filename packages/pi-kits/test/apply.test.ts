import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { applyResources, removeResources } from "../src/apply.js";
import { scanCatalog } from "../src/catalog.js";
import { loadManifest, manifestPathForProject } from "../src/manifest.js";
import { projectSettingsPathForRoot } from "../src/project-state.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createCatalogFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "pi-kits-apply-catalog-"));

  await mkdir(path.join(root, "skills", "frontend-design"), { recursive: true });
  await writeFile(path.join(root, "skills", "frontend-design", "SKILL.md"), "---\nname: frontend-design\n---\n# Skill\n");
  await writeFile(path.join(root, "skills", "frontend-design", "notes.md"), "extra skill file\n");

  await mkdir(path.join(root, "prompts"), { recursive: true });
  await writeFile(path.join(root, "prompts", "ui-review.md"), "Review this UI.\n");

  await mkdir(path.join(root, "extensions"), { recursive: true });
  await writeFile(path.join(root, "extensions", "component-preview.ts"), "export default function componentPreview() {}\n");

  await mkdir(path.join(root, "extensions", "package-preview"), { recursive: true });
  await writeFile(
    path.join(root, "extensions", "package-preview", "package.json"),
    JSON.stringify({ name: "@example/package-preview", pi: { extensions: ["./src/index.ts"] } }, null, 2),
  );
  await mkdir(path.join(root, "extensions", "package-preview", "src"), { recursive: true });
  await writeFile(path.join(root, "extensions", "package-preview", "src", "index.ts"), "export default function packagePreview() {}\n");

  return root;
}

async function createTempProject(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), "pi-kits-apply-project-"));
}

describe("applyResources and removeResources", () => {
  it("applies and removes all MVP resource types idempotently", async () => {
    const catalogRoot = await createCatalogFixture();
    const catalog = await scanCatalog(catalogRoot);
    const projectRoot = await createTempProject();
    const resources = [
      "skill:frontend-design",
      "prompt:ui-review",
      "extension:component-preview",
      "extension:package-preview",
    ].map((key) => catalog.resourcesByKey.get(key)!);

    await applyResources({ projectRoot, resources, now: "2026-05-24T00:00:00.000Z" });
    await applyResources({ projectRoot, resources, now: "2026-05-24T00:01:00.000Z" });

    await expect(readFile(path.join(projectRoot, ".pi", "skills", "frontend-design", "SKILL.md"), "utf8")).resolves.toContain("# Skill");
    await expect(readFile(path.join(projectRoot, ".pi", "skills", "frontend-design", "notes.md"), "utf8")).resolves.toContain("extra skill file");
    await expect(readFile(path.join(projectRoot, ".pi", "prompts", "ui-review.md"), "utf8")).resolves.toBe("Review this UI.\n");
    await expect(readFile(path.join(projectRoot, ".pi", "extensions", "component-preview.ts"), "utf8")).resolves.toContain("componentPreview");

    const packageExtensionDir = path.join(catalogRoot, "extensions", "package-preview");
    const settings = JSON.parse(await readFile(projectSettingsPathForRoot(projectRoot), "utf8")) as { extensions: string[] };
    expect(settings.extensions).toEqual([packageExtensionDir]);

    const manifest = await loadManifest(manifestPathForProject(projectRoot));
    expect(manifest.entries.map((entry) => entry.key).sort()).toEqual([
      "extension:component-preview",
      "extension:package-preview",
      "prompt:ui-review",
      "skill:frontend-design",
    ]);
    expect(manifest.entries.find((entry) => entry.key === "extension:package-preview")).toMatchObject({
      installMode: "reference",
      sourcePath: packageExtensionDir,
      targetPaths: [],
      settingsChanges: [{ type: "extension-reference", path: projectSettingsPathForRoot(projectRoot), value: packageExtensionDir }],
      notes: "Package extensions are referenced by catalog package directory in MVP.",
    });

    await removeResources({
      projectRoot,
      resourceKeys: resources.map((resource) => resource.key),
    });
    await removeResources({
      projectRoot,
      resourceKeys: resources.map((resource) => resource.key),
    });

    await expect(exists(path.join(projectRoot, ".pi", "skills", "frontend-design"))).resolves.toBe(false);
    await expect(exists(path.join(projectRoot, ".pi", "prompts", "ui-review.md"))).resolves.toBe(false);
    await expect(exists(path.join(projectRoot, ".pi", "extensions", "component-preview.ts"))).resolves.toBe(false);
    const settingsAfterRemove = JSON.parse(await readFile(projectSettingsPathForRoot(projectRoot), "utf8")) as { extensions: string[] };
    expect(settingsAfterRemove.extensions).toEqual([]);
    await expect(loadManifest(manifestPathForProject(projectRoot))).resolves.toEqual({ schemaVersion: 1, entries: [] });
  });

  it("preserves unrelated project settings while sorting and deduplicating extension references", async () => {
    const catalogRoot = await createCatalogFixture();
    const catalog = await scanCatalog(catalogRoot);
    const projectRoot = await createTempProject();
    const packageExtension = catalog.resourcesByKey.get("extension:package-preview")!;
    const settingsPath = projectSettingsPathForRoot(projectRoot);
    const packageExtensionDir = path.join(catalogRoot, "extensions", "package-preview");

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({ theme: "midnight", extensions: ["/z-extension", packageExtensionDir, "/a-extension"] }, null, 2));

    await applyResources({ projectRoot, resources: [packageExtension], now: "2026-05-24T00:00:00.000Z" });

    const settings = JSON.parse(await readFile(settingsPath, "utf8")) as { theme: string; extensions: string[] };
    expect(settings).toEqual({
      theme: "midnight",
      extensions: ["/a-extension", packageExtensionDir, "/z-extension"],
    });
  });

  it("refuses to overwrite unmanaged targets", async () => {
    const catalogRoot = await createCatalogFixture();
    const catalog = await scanCatalog(catalogRoot);
    const projectRoot = await createTempProject();
    const prompt = catalog.resourcesByKey.get("prompt:ui-review")!;
    const targetPath = path.join(projectRoot, ".pi", "prompts", "ui-review.md");

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, "unmanaged prompt\n");

    await expect(applyResources({ projectRoot, resources: [prompt] })).rejects.toThrow(/unmanaged target/i);
    await expect(readFile(targetPath, "utf8")).resolves.toBe("unmanaged prompt\n");
  });

  it("removal only touches manifest-managed targets and settings references", async () => {
    const catalogRoot = await createCatalogFixture();
    const catalog = await scanCatalog(catalogRoot);
    const projectRoot = await createTempProject();
    const prompt = catalog.resourcesByKey.get("prompt:ui-review")!;
    const settingsPath = projectSettingsPathForRoot(projectRoot);
    const unmanagedPath = path.join(projectRoot, ".pi", "prompts", "unmanaged.md");

    await applyResources({ projectRoot, resources: [prompt], now: "2026-05-24T00:00:00.000Z" });
    await mkdir(path.dirname(unmanagedPath), { recursive: true });
    await writeFile(unmanagedPath, "keep me\n");
    await writeFile(settingsPath, JSON.stringify({ extensions: ["/unmanaged-extension"] }, null, 2));

    await removeResources({ projectRoot, resourceKeys: [prompt.key] });

    await expect(exists(path.join(projectRoot, ".pi", "prompts", "ui-review.md"))).resolves.toBe(false);
    await expect(readFile(unmanagedPath, "utf8")).resolves.toBe("keep me\n");
    const settings = JSON.parse(await readFile(settingsPath, "utf8")) as { extensions: string[] };
    expect(settings.extensions).toEqual(["/unmanaged-extension"]);
  });

  it("does not claim or remove pre-existing unmanaged package extension references", async () => {
    const catalogRoot = await createCatalogFixture();
    const catalog = await scanCatalog(catalogRoot);
    const projectRoot = await createTempProject();
    const packageExtension = catalog.resourcesByKey.get("extension:package-preview")!;
    const settingsPath = projectSettingsPathForRoot(projectRoot);
    const packageExtensionDir = path.join(catalogRoot, "extensions", "package-preview");

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({ extensions: [packageExtensionDir] }, null, 2));

    await applyResources({ projectRoot, resources: [packageExtension], now: "2026-05-24T00:00:00.000Z" });

    const manifest = await loadManifest(manifestPathForProject(projectRoot));
    expect(manifest.entries.find((entry) => entry.key === packageExtension.key)?.settingsChanges).toEqual([]);

    await removeResources({ projectRoot, resourceKeys: [packageExtension.key] });

    const settingsAfterRemove = JSON.parse(await readFile(settingsPath, "utf8")) as { extensions: string[] };
    expect(settingsAfterRemove.extensions).toEqual([packageExtensionDir]);
  });
});
