export interface KitsPaths {
  agentDir: string;
  catalogPath: string;
  projectPiPath: string;
  projectSettingsPath: string;
  globalSettingsPath: string;
}

export interface KitsStatusPaths {
  catalogRoot: string;
  projectRoot: string;
  projectPiDir: string;
  projectSettingsPath: string;
  manifestPath: string;
}

export type StatusPaths = KitsStatusPaths;

export interface ResolveKitsPathsOptions {
  cwd?: string;
  agentDir?: string;
}

export type CatalogResourceType = "skill" | "prompt" | "extension" | "bundle";
export type ExtensionSourceKind = "single-file" | "package";
export type InstallMode = "copy" | "reference";

export interface CatalogWarning {
  code: string;
  message: string;
  path?: string;
  key?: string;
  resourceKey?: string;
}

export interface CatalogResource {
  key: string;
  type: CatalogResourceType;
  name: string;
  label: string;
  sourcePath: string;
  entryPath: string;
  fingerprint: string;
  description?: string;
  sourceKind?: ExtensionSourceKind;
  installMode?: InstallMode;
  resources?: string[];
}

export interface CatalogScanResult {
  catalogRoot: string;
  resources: CatalogResource[];
  resourcesByKey: Map<string, CatalogResource>;
  warnings: CatalogWarning[];
}

export interface BundleExpansionResult {
  resources: string[];
  warnings: CatalogWarning[];
}

export interface ManifestSettingsChange {
  type: "extension-reference";
  path: string;
  value: string;
}

export interface ManifestEntry {
  key: string;
  type: CatalogResourceType;
  label: string;
  installMode: InstallMode;
  sourcePath: string;
  targetPaths: string[];
  settingsChanges: ManifestSettingsChange[];
  installedAt: string;
  catalogFingerprint: string;
  notes?: string;
}

export interface KitsManifest {
  schemaVersion: 1;
  entries: ManifestEntry[];
}

export interface ProjectState {
  projectRoot: string;
  settingsPath: string;
  settingsExists: boolean;
  settings: Record<string, unknown>;
  extensions: string[];
}

export interface ProjectIssue {
  code: string;
  message: string;
  key?: string;
  path?: string;
  value?: string;
}

export interface PiKitsCustomTuiHandle {
  requestRender(): void;
}

export interface PiKitsCustomTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

export interface PiKitsCustomComponent {
  render(width: number): string[];
  invalidate(): void;
  handleInput?(data: string): void;
}

export interface PiKitsCommandContext {
  cwd?: string;
  hasUI?: boolean;
  ui?: {
    notify(message: string, level?: "info" | "warning" | "error"): void;
    custom?<T>(
      factory: (
        tui: PiKitsCustomTuiHandle,
        theme: PiKitsCustomTheme,
        keybindings: unknown,
        done: (result: T) => void,
      ) => PiKitsCustomComponent,
      options?: unknown,
    ): Promise<T>;
  };
}

export interface PiKitsExtensionApi {
  registerCommand(
    name: string,
    options: {
      description?: string;
      getArgumentCompletions?: (prefix: string) => Array<{ value: string; label: string }> | null;
      handler: (args: string, ctx: PiKitsCommandContext) => Promise<void> | void;
    },
  ): void;
}
