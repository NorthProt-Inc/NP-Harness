import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  detectUnmanagedTargetConflicts,
  loadManifest,
  manifestPathForProject,
  writeManifest,
} from "./manifest.js";
import { loadProjectState, projectSettingsPathForRoot } from "./project-state.js";
import type { CatalogResource, KitsManifest, ManifestEntry, ProjectIssue, ProjectState } from "./types.js";

export interface ApplyResourcesOptions {
  projectRoot: string;
  resources: CatalogResource[];
  manifestPath?: string;
  now?: string;
}

export interface RemoveResourcesOptions {
  projectRoot: string;
  resourceKeys: string[];
  manifestPath?: string;
}

export interface ResourceChangeResult {
  applied: string[];
  removed: string[];
  skipped: string[];
  manifest: KitsManifest;
}

export class ApplyResourcesError extends Error {
  constructor(message: string, readonly issues: ProjectIssue[]) {
    super(message);
    this.name = "ApplyResourcesError";
  }
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function ensureInstallableResource(resource: CatalogResource): void {
  if (resource.type === "bundle") {
    throw new ApplyResourcesError("Bundles must be expanded before apply.", [
      {
        code: "bundle-not-installable",
        message: `Bundle must be expanded before apply: ${resource.key}`,
        key: resource.key,
        path: resource.sourcePath,
      },
    ]);
  }

  if (resource.type === "extension" && resource.sourceKind !== "single-file" && resource.sourceKind !== "package") {
    throw new ApplyResourcesError("Extension resource is missing a supported source kind.", [
      {
        code: "unsupported-extension-source-kind",
        message: `Extension resource is missing a supported source kind: ${resource.key}`,
        key: resource.key,
        path: resource.sourcePath,
      },
    ]);
  }
}

function targetPathsForResource(resource: CatalogResource, projectRoot: string): string[] {
  const projectPiRoot = path.join(path.resolve(projectRoot), ".pi");

  if (resource.type === "skill") return [path.join(projectPiRoot, "skills", resource.name)];
  if (resource.type === "prompt") return [path.join(projectPiRoot, "prompts", `${resource.name}.md`)];
  if (resource.type === "extension" && resource.sourceKind === "single-file") {
    return [path.join(projectPiRoot, "extensions", `${resource.name}.ts`)];
  }

  return [];
}

function settingsReferenceForResource(resource: CatalogResource): string | null {
  if (resource.type !== "extension" || resource.sourceKind !== "package") return null;
  return path.resolve(resource.sourcePath);
}

async function copyResource(resource: CatalogResource, targetPaths: string[]): Promise<void> {
  if (targetPaths.length === 0) return;

  const targetPath = targetPaths[0];
  await mkdir(path.dirname(targetPath), { recursive: true });

  if (resource.type === "skill") {
    await cp(resource.sourcePath, targetPath, { recursive: true, force: true });
    return;
  }

  await cp(resource.sourcePath, targetPath, { force: true });
}

async function writeProjectSettings(projectState: ProjectState): Promise<void> {
  await mkdir(path.dirname(projectState.settingsPath), { recursive: true });
  await writeFile(projectState.settingsPath, `${JSON.stringify(projectState.settings, null, 2)}\n`, "utf8");
}

function upsertExtensionReference(projectState: ProjectState, reference: string): void {
  projectState.extensions = sortUnique([...projectState.extensions, reference]);
  projectState.settings.extensions = projectState.extensions;
}

function removeExtensionReferences(projectState: ProjectState, references: string[]): void {
  const removeSet = new Set(references);
  projectState.extensions = sortUnique(projectState.extensions.filter((extension) => !removeSet.has(extension)));
  projectState.settings.extensions = projectState.extensions;
}

function existingEntryFor(manifest: KitsManifest, key: string): ManifestEntry | undefined {
  return manifest.entries.find((entry) => entry.key === key);
}

function manifestEntryForResource(
  resource: CatalogResource,
  projectRoot: string,
  targetPaths: string[],
  installedAt: string,
  managedReference: string | null,
): ManifestEntry {
  const reference = settingsReferenceForResource(resource);
  const settingsPath = projectSettingsPathForRoot(projectRoot);

  return {
    key: resource.key,
    type: resource.type,
    label: resource.label,
    installMode: resource.installMode ?? (reference ? "reference" : "copy"),
    sourcePath: path.resolve(resource.sourcePath),
    targetPaths,
    settingsChanges: managedReference
      ? [{ type: "extension-reference", path: settingsPath, value: managedReference }]
      : [],
    installedAt,
    catalogFingerprint: resource.fingerprint,
    notes: reference ? "Package extensions are referenced by catalog package directory in MVP." : undefined,
  };
}

function sortManifest(manifest: KitsManifest): KitsManifest {
  return {
    schemaVersion: 1,
    entries: [...manifest.entries].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function replaceManifestEntries(manifest: KitsManifest, newEntries: ManifestEntry[]): KitsManifest {
  const replacementKeys = new Set(newEntries.map((entry) => entry.key));
  return sortManifest({
    schemaVersion: 1,
    entries: [
      ...manifest.entries.filter((entry) => !replacementKeys.has(entry.key)),
      ...newEntries,
    ],
  });
}

export async function applyResources(options: ApplyResourcesOptions): Promise<ResourceChangeResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const manifestPath = options.manifestPath ?? manifestPathForProject(projectRoot);
  const manifest = await loadManifest(manifestPath);
  const resources = options.resources;

  for (const resource of resources) ensureInstallableResource(resource);

  const plannedTargets = resources.flatMap((resource) => targetPathsForResource(resource, projectRoot));
  const conflicts = await detectUnmanagedTargetConflicts(plannedTargets, manifest);
  if (conflicts.length > 0) {
    throw new ApplyResourcesError("Refusing to overwrite unmanaged target paths.", conflicts);
  }

  let projectState: ProjectState | null = null;
  const applied: string[] = [];
  const skipped: string[] = [];
  const newEntries: ManifestEntry[] = [];

  for (const resource of resources) {
    const targetPaths = targetPathsForResource(resource, projectRoot);
    await copyResource(resource, targetPaths);

    const previousEntry = existingEntryFor(manifest, resource.key);
    const reference = settingsReferenceForResource(resource);
    let managedReference: string | null = null;
    if (reference) {
      projectState ??= await loadProjectState(projectRoot);
      const alreadyReferenced = projectState.extensions.includes(reference);
      const previouslyManaged = previousEntry?.settingsChanges.some(
        (change) => change.type === "extension-reference" && change.value === reference,
      ) ?? false;
      managedReference = previouslyManaged || !alreadyReferenced ? reference : null;
      upsertExtensionReference(projectState, reference);
    }

    const installedAt = previousEntry?.installedAt ?? options.now ?? new Date().toISOString();
    newEntries.push(manifestEntryForResource(resource, projectRoot, targetPaths, installedAt, managedReference));
    applied.push(resource.key);
  }

  if (projectState) await writeProjectSettings(projectState);

  const updatedManifest = replaceManifestEntries(manifest, newEntries);
  await writeManifest(manifestPath, updatedManifest);

  return { applied, removed: [], skipped, manifest: updatedManifest };
}

export async function removeResources(options: RemoveResourcesOptions): Promise<ResourceChangeResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const manifestPath = options.manifestPath ?? manifestPathForProject(projectRoot);
  const manifest = await loadManifest(manifestPath);
  const removeKeys = new Set(options.resourceKeys);
  const entriesToRemove = manifest.entries.filter((entry) => removeKeys.has(entry.key));
  const skipped = options.resourceKeys.filter((key) => !entriesToRemove.some((entry) => entry.key === key));
  const removed: string[] = [];

  for (const entry of entriesToRemove) {
    for (const targetPath of entry.targetPaths) {
      await rm(targetPath, { recursive: true, force: true });
    }
    removed.push(entry.key);
  }

  const referencesToRemove = entriesToRemove.flatMap((entry) =>
    entry.settingsChanges
      .filter((change) => change.type === "extension-reference")
      .map((change) => change.value),
  );

  if (referencesToRemove.length > 0) {
    const projectState = await loadProjectState(projectRoot);
    removeExtensionReferences(projectState, referencesToRemove);
    await writeProjectSettings(projectState);
  }

  const updatedManifest = sortManifest({
    schemaVersion: 1,
    entries: manifest.entries.filter((entry) => !removeKeys.has(entry.key)),
  });
  await writeManifest(manifestPath, updatedManifest);

  return { applied: [], removed, skipped, manifest: updatedManifest };
}

export { settingsReferenceForResource, targetPathsForResource };
