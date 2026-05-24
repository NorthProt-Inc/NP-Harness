import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

import { expandBundle } from "./catalog.js";
import type { CatalogResource, CatalogScanResult, KitsManifest, PiKitsCommandContext } from "./types.js";

export interface KitsSelectorItem {
  key: string;
  label: string;
  description?: string;
  kind: "resource" | "bundle";
  resourceType: CatalogResource["type"];
  expandedKeys: string[];
}

interface KitsSelectorTheme {
  accent(text: string): string;
  muted(text: string): string;
  warning(text: string): string;
  bold(text: string): string;
}

interface RenderableComponent {
  render(width: number): string[];
  invalidate(): void;
  handleInput(data: string): void;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function resourceDescription(resource: CatalogResource): string {
  if (resource.type === "extension" && resource.sourceKind === "package") {
    return "package extension, reference mode";
  }
  if (resource.type === "extension" && resource.sourceKind === "single-file") {
    return "single-file extension, copy mode";
  }
  return resource.installMode ? `${resource.type}, ${resource.installMode} mode` : resource.type;
}

export function buildSelectorItems(catalog: CatalogScanResult, manifest: KitsManifest): {
  items: KitsSelectorItem[];
  initialDesiredKeys: string[];
  selectableResourceKeys: string[];
} {
  const installedKeys = new Set(manifest.entries.map((entry) => entry.key));
  const items: KitsSelectorItem[] = [];
  const selectableResourceKeys = catalog.resources
    .filter((resource) => resource.type !== "bundle")
    .map((resource) => resource.key);

  for (const resource of catalog.resources) {
    if (resource.type === "bundle") {
      const expansion = expandBundle(catalog, resource.key);
      items.push({
        key: resource.key,
        label: resource.label,
        description: expansion.warnings.length > 0
          ? `bundle, ${expansion.resources.length} resources, ${expansion.warnings.length} warning(s)`
          : `bundle, ${expansion.resources.length} resources`,
        kind: "bundle",
        resourceType: "bundle",
        expandedKeys: expansion.resources,
      });
      continue;
    }

    items.push({
      key: resource.key,
      label: resource.label,
      description: resource.description ?? resourceDescription(resource),
      kind: "resource",
      resourceType: resource.type,
      expandedKeys: [resource.key],
    });
  }

  return {
    items,
    initialDesiredKeys: sorted(installedKeys),
    selectableResourceKeys: sorted(selectableResourceKeys),
  };
}

class KitsSelectorComponent implements RenderableComponent {
  private selectedIndex = 0;
  private desiredKeys: Set<string>;

  constructor(
    private readonly items: KitsSelectorItem[],
    initialDesiredKeys: string[],
    private readonly theme: KitsSelectorTheme,
    private readonly done: (result: string[] | null) => void,
  ) {
    this.desiredKeys = new Set(initialDesiredKeys);
  }

  invalidate(): void {
    // Stateless render; no cache to invalidate.
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return;
    }

    if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
      return;
    }

    if (matchesKey(data, Key.space)) {
      this.toggleSelectedItem();
      return;
    }

    if (matchesKey(data, Key.enter)) {
      this.done(sorted(this.desiredKeys));
      return;
    }

    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.done(null);
    }
  }

  render(width: number): string[] {
    const lines = [
      this.theme.accent(this.theme.bold("Pi Kits")),
      this.theme.muted("↑↓ navigate • space toggle • enter apply • esc cancel"),
      "",
    ];

    if (this.items.length === 0) {
      lines.push(this.theme.warning("No kit resources found."));
      return lines.map((line) => truncateToWidth(line, width));
    }

    for (const [index, item] of this.items.entries()) {
      const selected = index === this.selectedIndex;
      const checked = this.isItemDesired(item);
      const marker = selected ? ">" : " ";
      const checkbox = checked ? "[x]" : "[ ]";
      const kind = item.kind === "bundle" ? "bundle" : item.resourceType;
      const line = `${marker} ${checkbox} ${item.label} (${kind})`;
      lines.push(selected ? this.theme.accent(line) : line);

      if (item.description) {
        lines.push(this.theme.muted(`    ${item.description}`));
      }
    }

    return lines.map((line) => truncateToWidth(line, width));
  }

  private isItemDesired(item: KitsSelectorItem): boolean {
    if (item.expandedKeys.length === 0) return false;
    return item.expandedKeys.every((key) => this.desiredKeys.has(key));
  }

  private toggleSelectedItem(): void {
    const item = this.items[this.selectedIndex];
    if (!item) return;

    const shouldRemove = this.isItemDesired(item);
    for (const key of item.expandedKeys) {
      if (shouldRemove) this.desiredKeys.delete(key);
      else this.desiredKeys.add(key);
    }
  }
}

export async function showKitsSelector(
  ctx: PiKitsCommandContext,
  items: KitsSelectorItem[],
  initialDesiredKeys: string[],
): Promise<string[] | null> {
  if (ctx.hasUI === false || !ctx.ui?.custom) return null;

  return await ctx.ui.custom<string[] | null>((tui, theme, _keybindings, done) => {
    const selectorTheme: KitsSelectorTheme = {
      accent: (text) => theme.fg("accent", text),
      muted: (text) => theme.fg("muted", text),
      warning: (text) => theme.fg("warning", text),
      bold: (text) => theme.bold(text),
    };
    const component = new KitsSelectorComponent(items, initialDesiredKeys, selectorTheme, done);
    return {
      render: (width: number) => component.render(width),
      invalidate: () => component.invalidate(),
      handleInput: (data: string) => {
        component.handleInput(data);
        tui.requestRender();
      },
    };
  }, { overlay: true, overlayOptions: { width: "80%", maxHeight: "80%", minWidth: 48 } });
}
