import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CatalogScanResult,
  KitsManifest,
  ManifestEntry,
  ManifestSettingsChange,
  ProjectIssue,
  ProjectState,
} from "./types.js";

export class ManifestError extends Error {
  constructor(message: string, readonly manifestPath: string) {
    super(message);
    this.name = "ManifestError";
  }
}

export function manifestPathForProject(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".pi", "kits.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateSettingsChange(value: unknown): ManifestSettingsChange | null {
  if (!isRecord(value)) return null;
  if (value.type !== "extension-reference") return null;
  if (typeof value.path !== "string" || typeof value.value !== "string") return null;
  return {
    type: "extension-reference",
    path: value.path,
    value: value.value,
  };
}

function validateManifestEntry(value: unknown): ManifestEntry | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.settingsChanges)) return null;
  const settingsChanges = value.settingsChanges.map(validateSettingsChange);

  if (settingsChanges.some((change) => change === null)) return null;
  if (typeof value.key !== "string") return null;
  if (!["skill", "prompt", "extension", "bundle"].includes(String(value.type))) return null;
  if (typeof value.label !== "string") return null;
  if (!["copy", "reference"].includes(String(value.installMode))) return null;
  if (typeof value.sourcePath !== "string") return null;
  if (!Array.isArray(value.targetPaths) || !value.targetPaths.every((target) => typeof target === "string")) return null;
  if (typeof value.installedAt !== "string") return null;
  if (typeof value.catalogFingerprint !== "string") return null;
  if (value.notes !== undefined && typeof value.notes !== "string") return null;

  return {
    key: value.key,
    type: value.type as ManifestEntry["type"],
    label: value.label,
    installMode: value.installMode as ManifestEntry["installMode"],
    sourcePath: value.sourcePath,
    targetPaths: value.targetPaths,
    settingsChanges: settingsChanges as ManifestSettingsChange[],
    installedAt: value.installedAt,
    catalogFingerprint: value.catalogFingerprint,
    notes: value.notes,
  };
}

function parseManifest(raw: unknown, manifestPath: string): KitsManifest {
  if (!isRecord(raw)) {
    throw new ManifestError(`Invalid kits manifest at ${manifestPath}: expected an object`, manifestPath);
  }

  if (raw.schemaVersion !== 1) {
    throw new ManifestError(`Invalid kits manifest at ${manifestPath}: schemaVersion must be 1`, manifestPath);
  }

  if (!Array.isArray(raw.entries)) {
    throw new ManifestError(`Invalid kits manifest at ${manifestPath}: entries must be an array`, manifestPath);
  }

  const entries = raw.entries.map(validateManifestEntry);
  if (entries.some((entry) => entry === null)) {
    throw new ManifestError(`Invalid kits manifest at ${manifestPath}: invalid manifest entry`, manifestPath);
  }

  return { schemaVersion: 1, entries: entries as ManifestEntry[] };
}

export async function loadManifest(manifestPath: string): Promise<KitsManifest> {
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { schemaVersion: 1, entries: [] };
    throw new ManifestError(`Could not read kits manifest at ${manifestPath}`, manifestPath);
  }

  let parsed: unknown;
  try {
    parsed = raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    throw new ManifestError(`Invalid kits manifest JSON at ${manifestPath}: ${(error as Error).message}`, manifestPath);
  }

  return parseManifest(parsed, manifestPath);
}

export async function writeManifest(manifestPath: string, manifest: KitsManifest): Promise<void> {
  parseManifest(manifest, manifestPath);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function manifestOwnsTarget(manifest: KitsManifest, targetPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  return manifest.entries.some((entry) =>
    entry.targetPaths.some((managedPath) => path.resolve(managedPath) === resolvedTarget),
  );
}

export async function detectUnmanagedTargetConflicts(
  targetPaths: string[],
  manifest: KitsManifest,
): Promise<ProjectIssue[]> {
  const conflicts: ProjectIssue[] = [];

  for (const targetPath of [...new Set(targetPaths.map((target) => path.resolve(target)))].sort()) {
    if (manifestOwnsTarget(manifest, targetPath)) continue;
    if (!(await pathExists(targetPath))) continue;

    conflicts.push({
      code: "unmanaged-target-exists",
      message: `Target exists but is not managed by .pi/kits.json: ${targetPath}`,
      path: targetPath,
    });
  }

  return conflicts;
}

function detectSettingsDrift(entry: ManifestEntry, projectState: ProjectState): ProjectIssue[] {
  const issues: ProjectIssue[] = [];

  for (const change of entry.settingsChanges) {
    if (change.type !== "extension-reference") continue;
    if (projectState.extensions.includes(change.value)) continue;

    issues.push({
      code: "settings-reference-missing",
      message: `Missing managed extension reference in project settings: ${change.value}`,
      key: entry.key,
      path: change.path,
      value: change.value,
    });
  }

  return issues;
}

export async function detectManifestDrift(
  manifest: KitsManifest,
  catalog: CatalogScanResult,
  projectState: ProjectState,
): Promise<ProjectIssue[]> {
  const issues: ProjectIssue[] = [];

  for (const entry of manifest.entries) {
    if (!catalog.resourcesByKey.has(entry.key) || !(await pathExists(entry.sourcePath))) {
      issues.push({
        code: "catalog-source-missing",
        message: `Catalog source is missing for managed resource: ${entry.key}`,
        key: entry.key,
        path: entry.sourcePath,
      });
    }

    for (const targetPath of entry.targetPaths) {
      if (await pathExists(targetPath)) continue;
      issues.push({
        code: "managed-target-missing",
        message: `Managed target is missing: ${targetPath}`,
        key: entry.key,
        path: targetPath,
      });
    }

    issues.push(...detectSettingsDrift(entry, projectState));
  }

  return issues;
}
