import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter.js";
import type {
  BundleExpansionResult,
  CatalogResource,
  CatalogScanResult,
  CatalogWarning,
} from "./types.js";

interface DirectoryEntry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

function fingerprint(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function resourceKey(type: CatalogResource["type"], name: string): string {
  return `${type}:${name}`;
}

function humanizeName(name: string): string {
  return name;
}

async function readDirectorySafe(dir: string, warnings: CatalogWarning[]): Promise<DirectoryEntry[]> {
  try {
    return (await readdir(dir, { withFileTypes: true })) as DirectoryEntry[];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    warnings.push({
      code: "catalog-directory-unreadable",
      message: `Could not read catalog directory: ${dir}`,
      path: dir,
    });
    return [];
  }
}

async function readTextSafe(filePath: string, warnings: CatalogWarning[], code: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    warnings.push({
      code,
      message: `Could not read catalog file: ${filePath}`,
      path: filePath,
    });
    return null;
  }
}

function addResource(resources: CatalogResource[], warnings: CatalogWarning[], resource: CatalogResource): void {
  if (resources.some((existing) => existing.key === resource.key)) {
    warnings.push({
      code: "duplicate-resource-key",
      message: `Duplicate catalog resource key: ${resource.key}`,
      path: resource.sourcePath,
      key: resource.key,
    });
    return;
  }

  resources.push(resource);
}

async function scanSkills(catalogRoot: string, resources: CatalogResource[], warnings: CatalogWarning[]): Promise<void> {
  const skillsDir = path.join(catalogRoot, "skills");
  const entries = await readDirectorySafe(skillsDir, warnings);

  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const sourcePath = path.join(skillsDir, entry.name);
    const entryPath = path.join(sourcePath, "SKILL.md");
    const content = await readTextSafe(entryPath, warnings, "invalid-skill");
    if (content === null) continue;

    const frontmatter = parseFrontmatter(content).data;
    const name = entry.name;
    addResource(resources, warnings, {
      key: resourceKey("skill", name),
      type: "skill",
      name,
      label: frontmatter.name || humanizeName(name),
      description: frontmatter.description,
      sourcePath,
      entryPath,
      fingerprint: fingerprint(content),
      installMode: "copy",
    });
  }
}

async function scanPrompts(catalogRoot: string, resources: CatalogResource[], warnings: CatalogWarning[]): Promise<void> {
  const promptsDir = path.join(catalogRoot, "prompts");
  const entries = await readDirectorySafe(promptsDir, warnings);

  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".md")).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(promptsDir, entry.name);
    const content = await readTextSafe(entryPath, warnings, "invalid-prompt");
    if (content === null) continue;

    const name = path.basename(entry.name, ".md");
    const frontmatter = parseFrontmatter(content).data;
    addResource(resources, warnings, {
      key: resourceKey("prompt", name),
      type: "prompt",
      name,
      label: frontmatter.name || humanizeName(name),
      description: frontmatter.description,
      sourcePath: entryPath,
      entryPath,
      fingerprint: fingerprint(content),
      installMode: "copy",
    });
  }
}

async function scanExtensions(catalogRoot: string, resources: CatalogResource[], warnings: CatalogWarning[]): Promise<void> {
  const extensionsDir = path.join(catalogRoot, "extensions");
  const entries = await readDirectorySafe(extensionsDir, warnings);
  const sortedEntries = entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sortedEntries.filter((item) => item.isFile() && item.name.endsWith(".ts"))) {
    const entryPath = path.join(extensionsDir, entry.name);
    const content = await readTextSafe(entryPath, warnings, "invalid-extension");
    if (content === null) continue;

    const name = path.basename(entry.name, ".ts");
    addResource(resources, warnings, {
      key: resourceKey("extension", name),
      type: "extension",
      name,
      label: humanizeName(name),
      sourcePath: entryPath,
      entryPath,
      fingerprint: fingerprint(content),
      sourceKind: "single-file",
      installMode: "copy",
    });
  }

  for (const entry of sortedEntries.filter((item) => item.isDirectory())) {
    const sourcePath = path.join(extensionsDir, entry.name);
    const packagePath = path.join(sourcePath, "package.json");
    let packageJson: string | null = null;

    try {
      packageJson = await readFile(packagePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        warnings.push({
          code: "invalid-extension-package-json",
          message: `Could not read extension package.json: ${packagePath}`,
          path: packagePath,
        });
        continue;
      }

      const indexPath = path.join(sourcePath, "index.ts");
      try {
        await readFile(indexPath, "utf8");
        warnings.push({
          code: "extension-directory-without-package",
          message: "Extension directories with index.ts but no package.json are out of MVP.",
          path: sourcePath,
        });
      } catch {
        // A plain directory with neither package.json nor index.ts is ignored.
      }
      continue;
    }

    const name = entry.name;
    let label = humanizeName(name);
    try {
      const parsed = JSON.parse(packageJson) as { displayName?: unknown; name?: unknown };
      if (typeof parsed.displayName === "string") label = parsed.displayName;
      else if (typeof parsed.name === "string") label = parsed.name;
    } catch {
      warnings.push({
        code: "invalid-extension-package-json",
        message: `Invalid extension package.json: ${packagePath}`,
        path: packagePath,
      });
      continue;
    }

    addResource(resources, warnings, {
      key: resourceKey("extension", name),
      type: "extension",
      name,
      label,
      sourcePath,
      entryPath: packagePath,
      fingerprint: fingerprint(packageJson),
      sourceKind: "package",
      installMode: "reference",
    });
  }
}

function parseBundleResources(parsed: unknown): string[] | null {
  if (!parsed || typeof parsed !== "object") return null;
  const resources = (parsed as { resources?: unknown }).resources;
  if (!Array.isArray(resources) || !resources.every((item) => typeof item === "string")) return null;
  return resources;
}

async function scanBundles(catalogRoot: string, resources: CatalogResource[], warnings: CatalogWarning[]): Promise<void> {
  const bundlesDir = path.join(catalogRoot, "bundles");
  const entries = await readDirectorySafe(bundlesDir, warnings);

  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(bundlesDir, entry.name);
    const content = await readTextSafe(entryPath, warnings, "invalid-bundle");
    if (content === null) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      warnings.push({
        code: "invalid-bundle-json",
        message: `Invalid bundle JSON: ${entryPath}`,
        path: entryPath,
      });
      continue;
    }

    const bundleResources = parseBundleResources(parsed);
    if (bundleResources === null) {
      warnings.push({
        code: "invalid-bundle-resources",
        message: `Bundle resources must be an array of strings: ${entryPath}`,
        path: entryPath,
      });
      continue;
    }

    const name = path.basename(entry.name, ".json");
    const explicitName = (parsed as { name?: unknown }).name;
    const description = (parsed as { description?: unknown }).description;
    addResource(resources, warnings, {
      key: resourceKey("bundle", name),
      type: "bundle",
      name,
      label: typeof explicitName === "string" ? explicitName : humanizeName(name),
      description: typeof description === "string" ? description : undefined,
      sourcePath: entryPath,
      entryPath,
      fingerprint: fingerprint(content),
      resources: bundleResources,
    });
  }
}

export async function scanCatalog(catalogRoot: string): Promise<CatalogScanResult> {
  const resources: CatalogResource[] = [];
  const warnings: CatalogWarning[] = [];
  const resolvedRoot = path.resolve(catalogRoot);

  await scanSkills(resolvedRoot, resources, warnings);
  await scanPrompts(resolvedRoot, resources, warnings);
  await scanExtensions(resolvedRoot, resources, warnings);
  await scanBundles(resolvedRoot, resources, warnings);

  resources.sort((a, b) => a.key.localeCompare(b.key));

  return {
    catalogRoot: resolvedRoot,
    resources,
    resourcesByKey: new Map(resources.map((resource) => [resource.key, resource])),
    warnings,
  };
}

function expandBundleInto(
  catalog: CatalogScanResult,
  bundleKey: string,
  output: Set<string>,
  warnings: CatalogWarning[],
  stack: string[],
): void {
  const bundle = catalog.resourcesByKey.get(bundleKey);
  if (!bundle || bundle.type !== "bundle") {
    warnings.push({
      code: "bundle-resource-missing",
      message: `Missing bundle resource: ${bundleKey}`,
      key: stack[0] ?? bundleKey,
      resourceKey: bundleKey,
    });
    return;
  }

  if (stack.includes(bundleKey)) {
    warnings.push({
      code: "bundle-cycle",
      message: `Bundle cycle detected: ${[...stack, bundleKey].join(" -> ")}`,
      key: stack[0] ?? bundleKey,
      resourceKey: bundleKey,
    });
    return;
  }

  for (const resource of bundle.resources ?? []) {
    if (resource.startsWith("bundle:")) {
      expandBundleInto(catalog, resource, output, warnings, [...stack, bundleKey]);
      continue;
    }

    if (!catalog.resourcesByKey.has(resource)) {
      warnings.push({
        code: "bundle-resource-missing",
        message: `Bundle references missing resource: ${resource}`,
        key: stack[0] ?? bundleKey,
        resourceKey: resource,
      });
      continue;
    }

    output.add(resource);
  }
}

export function expandBundle(catalog: CatalogScanResult, bundleKey: string): BundleExpansionResult {
  const resources = new Set<string>();
  const warnings: CatalogWarning[] = [];
  expandBundleInto(catalog, bundleKey, resources, warnings, []);

  return {
    resources: [...resources].sort((a, b) => a.localeCompare(b)),
    warnings,
  };
}
