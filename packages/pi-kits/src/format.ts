import type { CatalogResource, CatalogWarning, KitsManifest, KitsStatusPaths, ProjectIssue } from "./types.js";

export interface ApplySummaryInput {
  added: string[];
  removed: string[];
  skipped: string[];
}

function bulletList(items: string[], empty: string): string[] {
  if (items.length === 0) return [`- ${empty}`];
  return items.map((item) => `- ${item}`);
}

function formatWarnings(warnings: CatalogWarning[]): string[] {
  if (warnings.length === 0) return ["- none"];
  return warnings.map((warning) => {
    const location = warning.path ? ` (${warning.path})` : "";
    return `- ${warning.code}: ${warning.message}${location}`;
  });
}

function formatIssues(issues: ProjectIssue[]): string[] {
  if (issues.length === 0) return ["- none"];
  return issues.map((issue) => {
    const detail = issue.value ?? issue.path ?? issue.key ?? "";
    return `- ${issue.code}: ${issue.message}${detail ? ` [${detail}]` : ""}`;
  });
}

export function formatStatusReport(input: {
  paths: KitsStatusPaths;
  resources: CatalogResource[];
  manifest: KitsManifest;
  catalogWarnings: CatalogWarning[];
  driftIssues: ProjectIssue[];
}): string {
  const managedKeys = input.manifest.entries.map((entry) => entry.key).sort((a, b) => a.localeCompare(b));
  const resourceKeys = input.resources.map((resource) => resource.key).sort((a, b) => a.localeCompare(b));

  return [
    "Pi Kits status",
    `Catalog: ${input.paths.catalogRoot}`,
    `Project root: ${input.paths.projectRoot}`,
    `Project .pi: ${input.paths.projectPiDir}`,
    `Project settings: ${input.paths.projectSettingsPath}`,
    `Manifest: ${input.paths.manifestPath}`,
    "",
    `Catalog resources: ${resourceKeys.length}`,
    ...bulletList(resourceKeys, "none"),
    "",
    `Managed resources: ${managedKeys.length}`,
    ...bulletList(managedKeys, "none"),
    "",
    "Drift warnings:",
    ...formatIssues(input.driftIssues),
    "",
    "Catalog warnings:",
    ...formatWarnings(input.catalogWarnings),
  ].join("\n");
}

export function formatApplySummary(summary: ApplySummaryInput): string {
  const changed = summary.added.length + summary.removed.length;
  const lines = [
    `Pi Kits apply complete: added ${summary.added.length}, removed ${summary.removed.length}, skipped ${summary.skipped.length}.`,
  ];

  if (summary.skipped.length > 0) {
    lines.push(`Skipped: ${summary.skipped.join(", ")}`);
  }

  if (changed > 0) {
    lines.push("Run /reload to load changed skills, prompts, and extensions.");
  } else {
    lines.push("No changes were needed.");
  }

  return lines.join("\n");
}
