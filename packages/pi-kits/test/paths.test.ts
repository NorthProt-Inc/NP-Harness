import { describe, expect, it } from "vitest";
import { formatKitsStatus, getStatusPaths, resolveKitsPaths } from "../src/index.js";
import { AGENT_ROOT, CATALOG_ROOT } from "../src/paths.js";

describe("pi-kits path helpers", () => {
  it("uses the global pi agent kits catalog", () => {
    expect(AGENT_ROOT).toMatch(/\.pi\/agent$/);
    expect(CATALOG_ROOT).toBe(`${AGENT_ROOT}/kits`);
  });

  it("derives project-local .pi paths from the current working directory", () => {
    expect(getStatusPaths("/tmp/example-project")).toEqual({
      catalogRoot: CATALOG_ROOT,
      projectRoot: "/tmp/example-project",
      projectPiDir: "/tmp/example-project/.pi",
      projectSettingsPath: "/tmp/example-project/.pi/settings.json",
      manifestPath: "/tmp/example-project/.pi/kits.json",
    });
  });

  it("supports explicit path resolution for future scanner code", () => {
    expect(resolveKitsPaths({
      cwd: "/tmp/example-project",
      agentDir: AGENT_ROOT,
    })).toEqual({
      agentDir: AGENT_ROOT,
      catalogPath: CATALOG_ROOT,
      projectPiPath: "/tmp/example-project/.pi",
      projectSettingsPath: "/tmp/example-project/.pi/settings.json",
      globalSettingsPath: `${AGENT_ROOT}/settings.json`,
    });
  });

  it("formats read-only status output with catalog and project paths", () => {
    const status = formatKitsStatus(getStatusPaths("/tmp/example-project"));

    expect(status).toContain("Pi Kits status");
    expect(status).toContain(`Catalog: ${CATALOG_ROOT}`);
    expect(status).toContain("Project .pi: /tmp/example-project/.pi");
    expect(status).toContain("Project settings: /tmp/example-project/.pi/settings.json");
    expect(status).toContain("Manifest: /tmp/example-project/.pi/kits.json");
  });
});
