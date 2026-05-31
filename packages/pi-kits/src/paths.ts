import { homedir } from "node:os";
import path from "node:path";

import type { KitsPaths, KitsStatusPaths, ResolveKitsPathsOptions } from "./types.js";

function normalizeDirectory(input: string): string {
  return path.resolve(input);
}

const DEFAULT_AGENT_ROOT = path.join(homedir(), ".pi", "agent");

export const AGENT_ROOT = normalizeDirectory(
  process.env.PI_AGENT_DIR ?? process.env.PI_CODING_AGENT_DIR ?? DEFAULT_AGENT_ROOT,
);
export const CATALOG_ROOT = path.join(AGENT_ROOT, "kits");

export function getStatusPaths(cwd: string = process.cwd()): KitsStatusPaths {
  const projectRoot = normalizeDirectory(cwd);
  const projectPiDir = path.join(projectRoot, ".pi");

  return {
    catalogRoot: CATALOG_ROOT,
    projectRoot,
    projectPiDir,
    projectSettingsPath: path.join(projectPiDir, "settings.json"),
    manifestPath: path.join(projectPiDir, "kits.json"),
  };
}

export function resolveKitsPaths(options: ResolveKitsPathsOptions = {}): KitsPaths {
  const agentDir = normalizeDirectory(options.agentDir ?? AGENT_ROOT);
  const cwd = normalizeDirectory(options.cwd ?? process.cwd());
  const projectPiPath = path.join(cwd, ".pi");

  return {
    agentDir,
    catalogPath: path.join(agentDir, "kits"),
    projectPiPath,
    projectSettingsPath: path.join(projectPiPath, "settings.json"),
    globalSettingsPath: path.join(agentDir, "settings.json"),
  };
}

export function formatKitsStatus(paths: KitsStatusPaths | KitsPaths): string {
  if ("catalogRoot" in paths) {
    return [
      "Pi Kits status",
      `Catalog: ${paths.catalogRoot}`,
      `Project root: ${paths.projectRoot}`,
      `Project .pi: ${paths.projectPiDir}`,
      `Project settings: ${paths.projectSettingsPath}`,
      `Manifest: ${paths.manifestPath}`,
    ].join("\n");
  }

  return [
    "Pi Kits status",
    `Catalog: ${paths.catalogPath}`,
    `Project .pi: ${paths.projectPiPath}`,
    `Project settings: ${paths.projectSettingsPath}`,
    `Manifest: ${path.join(paths.projectPiPath, "kits.json")}`,
    `Global settings: ${paths.globalSettingsPath}`,
  ].join("\n");
}
