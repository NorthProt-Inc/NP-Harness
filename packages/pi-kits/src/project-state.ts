import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ProjectState } from "./types.js";

export class ProjectSettingsError extends Error {
  constructor(message: string, readonly settingsPath: string) {
    super(message);
    this.name = "ProjectSettingsError";
  }
}

export function projectSettingsPathForRoot(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".pi", "settings.json");
}

function readExtensions(settings: Record<string, unknown>, settingsPath: string): string[] {
  const extensions = settings.extensions;
  if (extensions === undefined) return [];
  if (!Array.isArray(extensions) || !extensions.every((value) => typeof value === "string")) {
    throw new ProjectSettingsError(`Invalid project settings JSON at ${settingsPath}: extensions must be an array of strings`, settingsPath);
  }
  return extensions;
}

export async function loadProjectState(projectRoot: string): Promise<ProjectState> {
  const resolvedRoot = path.resolve(projectRoot);
  const settingsPath = projectSettingsPathForRoot(resolvedRoot);

  let raw: string;
  try {
    raw = await readFile(settingsPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {
        projectRoot: resolvedRoot,
        settingsPath,
        settingsExists: false,
        settings: {},
        extensions: [],
      };
    }
    throw new ProjectSettingsError(`Could not read project settings: ${settingsPath}`, settingsPath);
  }

  let parsed: unknown;
  try {
    parsed = raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    throw new ProjectSettingsError(`Invalid project settings JSON at ${settingsPath}: ${(error as Error).message}`, settingsPath);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ProjectSettingsError(`Invalid project settings JSON at ${settingsPath}: expected an object`, settingsPath);
  }

  const settings = parsed as Record<string, unknown>;
  return {
    projectRoot: resolvedRoot,
    settingsPath,
    settingsExists: true,
    settings,
    extensions: readExtensions(settings, settingsPath),
  };
}
