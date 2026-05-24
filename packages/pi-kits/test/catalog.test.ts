import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { expandBundle, scanCatalog } from "../src/catalog.js";
import { parseFrontmatter } from "../src/frontmatter.js";

async function createCatalogFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "pi-kits-catalog-"));

  await mkdir(path.join(root, "skills", "frontend-design"), { recursive: true });
  await writeFile(
    path.join(root, "skills", "frontend-design", "SKILL.md"),
    [
      "---",
      "name: frontend-design",
      "description: Production frontend design skill",
      "---",
      "# Frontend Design",
      "",
    ].join("\n"),
  );

  await mkdir(path.join(root, "prompts"), { recursive: true });
  await writeFile(
    path.join(root, "prompts", "ui-review.md"),
    [
      "---",
      "description: Review a UI implementation",
      "---",
      "Review this UI.",
      "",
    ].join("\n"),
  );

  await mkdir(path.join(root, "extensions"), { recursive: true });
  await writeFile(
    path.join(root, "extensions", "component-preview.ts"),
    "export default function componentPreview() {}\n",
  );

  await mkdir(path.join(root, "extensions", "package-preview"), { recursive: true });
  await writeFile(
    path.join(root, "extensions", "package-preview", "package.json"),
    JSON.stringify({ name: "@example/package-preview", pi: { extensions: ["./src/index.ts"] } }, null, 2),
  );
  await writeFile(path.join(root, "extensions", "package-preview", "index.ts"), "export default function ignored() {}\n");

  await mkdir(path.join(root, "extensions", "orphan-extension"), { recursive: true });
  await writeFile(path.join(root, "extensions", "orphan-extension", "index.ts"), "export default function orphan() {}\n");

  await mkdir(path.join(root, "bundles"), { recursive: true });
  await writeFile(
    path.join(root, "bundles", "frontend.json"),
    JSON.stringify({
      name: "frontend",
      description: "Frontend bundle",
      resources: [
        "skill:frontend-design",
        "prompt:ui-review",
        "extension:component-preview",
        "extension:package-preview",
      ],
    }, null, 2),
  );

  await writeFile(
    path.join(root, "bundles", "nested.json"),
    JSON.stringify({
      name: "nested",
      resources: ["bundle:frontend", "missing:resource"],
    }, null, 2),
  );

  await writeFile(path.join(root, "bundles", "broken.json"), "{not json");

  return root;
}

describe("parseFrontmatter", () => {
  it("parses simple YAML-like string fields", () => {
    expect(parseFrontmatter("---\nname: demo\ndescription: Hello world\n---\nBody")).toEqual({
      data: { name: "demo", description: "Hello world" },
      body: "Body",
    });
  });

  it("returns an empty data object when frontmatter is absent", () => {
    expect(parseFrontmatter("Body only")).toEqual({ data: {}, body: "Body only" });
  });
});

describe("scanCatalog", () => {
  it("scans resources deterministically with stable keys, labels, paths, and fingerprints", async () => {
    const root = await createCatalogFixture();
    const result = await scanCatalog(root);

    expect(result.resources.map((resource) => resource.key)).toEqual([
      "bundle:frontend",
      "bundle:nested",
      "extension:component-preview",
      "extension:package-preview",
      "prompt:ui-review",
      "skill:frontend-design",
    ]);

    const skill = result.resourcesByKey.get("skill:frontend-design");
    expect(skill).toMatchObject({
      type: "skill",
      name: "frontend-design",
      label: "frontend-design",
      description: "Production frontend design skill",
      sourcePath: path.join(root, "skills", "frontend-design"),
      entryPath: path.join(root, "skills", "frontend-design", "SKILL.md"),
    });
    expect(skill?.fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const packageExtension = result.resourcesByKey.get("extension:package-preview");
    expect(packageExtension).toMatchObject({
      type: "extension",
      name: "package-preview",
      sourceKind: "package",
      installMode: "reference",
      sourcePath: path.join(root, "extensions", "package-preview"),
      entryPath: path.join(root, "extensions", "package-preview", "package.json"),
    });

    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: "extension-directory-without-package",
      path: path.join(root, "extensions", "orphan-extension"),
    }));
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: "invalid-bundle-json",
      path: path.join(root, "bundles", "broken.json"),
    }));
  });

  it("expands bundles to concrete non-bundle resource keys and warns for missing keys", async () => {
    const root = await createCatalogFixture();
    const result = await scanCatalog(root);

    expect(expandBundle(result, "bundle:frontend")).toEqual({
      resources: [
        "extension:component-preview",
        "extension:package-preview",
        "prompt:ui-review",
        "skill:frontend-design",
      ],
      warnings: [],
    });

    const nested = expandBundle(result, "bundle:nested");
    expect(nested.resources).toEqual([
      "extension:component-preview",
      "extension:package-preview",
      "prompt:ui-review",
      "skill:frontend-design",
    ]);
    expect(nested.warnings).toContainEqual(expect.objectContaining({
      code: "bundle-resource-missing",
      key: "bundle:nested",
      resourceKey: "missing:resource",
    }));
  });
});
