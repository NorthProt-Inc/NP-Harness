import { applyResources, ApplyResourcesError, removeResources } from "./apply.js";
import { expandBundle, scanCatalog } from "./catalog.js";
import { formatApplySummary, formatStatusReport } from "./format.js";
import { detectManifestDrift, loadManifest } from "./manifest.js";
import { getStatusPaths } from "./paths.js";
import { loadProjectState } from "./project-state.js";
import { buildSelectorItems, showKitsSelector } from "./ui.js";
import type { CatalogResource, CatalogScanResult, PiKitsCommandContext, PiKitsExtensionApi } from "./types.js";

const STATUS_SUBCOMMAND = "status";

function notify(ctx: PiKitsCommandContext, message: string, level: "info" | "warning" | "error" = "info"): void {
  if (ctx.hasUI !== false && ctx.ui) {
    ctx.ui.notify(message, level);
    return;
  }

  console.log(message);
}

function findConcreteResource(catalog: CatalogScanResult, key: string): CatalogResource | null {
  const resource = catalog.resourcesByKey.get(key);
  if (!resource || resource.type === "bundle") return null;
  return resource;
}

async function showStatus(ctx: PiKitsCommandContext): Promise<void> {
  const paths = getStatusPaths(ctx.cwd ?? process.cwd());
  const catalog = await scanCatalog(paths.catalogRoot);
  const manifest = await loadManifest(paths.manifestPath);
  const projectState = await loadProjectState(paths.projectRoot);
  const driftIssues = await detectManifestDrift(manifest, catalog, projectState);

  notify(ctx, formatStatusReport({
    paths,
    resources: catalog.resources,
    manifest,
    catalogWarnings: catalog.warnings,
    driftIssues,
  }), driftIssues.length > 0 || catalog.warnings.length > 0 ? "warning" : "info");
}

function concreteKeysForCatalog(catalog: CatalogScanResult): Set<string> {
  const keys = new Set<string>();
  for (const resource of catalog.resources) {
    if (resource.type !== "bundle") keys.add(resource.key);
  }
  return keys;
}

function desiredKeysFromSelection(catalog: CatalogScanResult, selectedKeys: string[]): Set<string> {
  const desired = new Set<string>();

  for (const key of selectedKeys) {
    const resource = catalog.resourcesByKey.get(key);
    if (!resource) continue;

    if (resource.type === "bundle") {
      for (const expandedKey of expandBundle(catalog, key).resources) desired.add(expandedKey);
      continue;
    }

    desired.add(key);
  }

  return desired;
}

async function applyDesiredState(ctx: PiKitsCommandContext): Promise<void> {
  const paths = getStatusPaths(ctx.cwd ?? process.cwd());
  const catalog = await scanCatalog(paths.catalogRoot);
  const manifest = await loadManifest(paths.manifestPath);
  const { items, initialDesiredKeys } = buildSelectorItems(catalog, manifest);

  const selectedKeys = await showKitsSelector(ctx, items, initialDesiredKeys);
  if (selectedKeys === null) {
    notify(ctx, ctx.ui?.custom ? "Pi Kits cancelled." : "Interactive /kits requires the Pi UI. Use /kits status in non-interactive mode.", "info");
    return;
  }

  const desiredKeys = desiredKeysFromSelection(catalog, selectedKeys);
  const selectableKeys = concreteKeysForCatalog(catalog);
  const installedSelectableKeys = manifest.entries
    .map((entry) => entry.key)
    .filter((key) => selectableKeys.has(key));

  const keysToRemove = installedSelectableKeys.filter((key) => !desiredKeys.has(key));
  const keysToApply = [...desiredKeys].filter((key) => !manifest.entries.some((entry) => entry.key === key));

  const added: string[] = [];
  const removed: string[] = [];
  const skipped: string[] = [];

  if (keysToRemove.length > 0) {
    const result = await removeResources({ projectRoot: paths.projectRoot, resourceKeys: keysToRemove });
    removed.push(...result.removed);
    skipped.push(...result.skipped);
  }

  for (const key of keysToApply.sort((a, b) => a.localeCompare(b))) {
    const resource = findConcreteResource(catalog, key);
    if (!resource) {
      skipped.push(key);
      continue;
    }

    try {
      const result = await applyResources({ projectRoot: paths.projectRoot, resources: [resource] });
      added.push(...result.applied);
      skipped.push(...result.skipped);
    } catch (error) {
      if (error instanceof ApplyResourcesError) {
        skipped.push(key);
        notify(ctx, error.issues.map((issue) => issue.message).join("\n"), "warning");
        continue;
      }
      throw error;
    }
  }

  notify(ctx, formatApplySummary({ added, removed, skipped }), skipped.length > 0 ? "warning" : "info");
}

export default function piKitsExtension(pi: PiKitsExtensionApi): void {
  pi.registerCommand("kits", {
    description: "Manage Pi project kits",
    getArgumentCompletions: (prefix: string) => {
      const normalizedPrefix = prefix.trim();
      return STATUS_SUBCOMMAND.startsWith(normalizedPrefix)
        ? [{ value: STATUS_SUBCOMMAND, label: STATUS_SUBCOMMAND }]
        : null;
    },
    handler: async (args: string, ctx: PiKitsCommandContext) => {
      const subcommand = args.trim();

      if (subcommand === STATUS_SUBCOMMAND) {
        await showStatus(ctx);
        return;
      }

      if (subcommand !== "") {
        notify(ctx, "Usage: /kits or /kits status", "warning");
        return;
      }

      await applyDesiredState(ctx);
    },
  });
}

export { applyResources, removeResources } from "./apply.js";
export { expandBundle, scanCatalog } from "./catalog.js";
export { formatApplySummary, formatStatusReport } from "./format.js";
export { parseFrontmatter } from "./frontmatter.js";
export { detectManifestDrift, detectUnmanagedTargetConflicts, loadManifest, manifestPathForProject, writeManifest } from "./manifest.js";
export { loadProjectState, projectSettingsPathForRoot } from "./project-state.js";
export { formatKitsStatus, getStatusPaths, resolveKitsPaths } from "./paths.js";
export { buildSelectorItems, showKitsSelector } from "./ui.js";
export type { ApplyResourcesOptions, RemoveResourcesOptions, ResourceChangeResult } from "./apply.js";
export type { ApplySummaryInput } from "./format.js";
export type { KitsSelectorItem } from "./ui.js";
export type { CatalogResource, CatalogScanResult, CatalogWarning, KitsManifest, KitsPaths, KitsStatusPaths, ManifestEntry, ProjectIssue, ProjectState, ResolveKitsPathsOptions } from "./types.js";
