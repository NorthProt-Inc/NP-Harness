import { describe, expect, it } from "vitest";
import { formatKitsStatus, getStatusPaths, resolveKitsPaths } from "../src/index.js";
import { AGENT_ROOT, CATALOG_ROOT } from "../src/paths.js";

const expectedAgentRoot = process.env.PI_AGENT_DIR
  ?? process.env.PI_CODING_AGENT_DIR
  ?? `${process.env.HOME}/.pi/agent`;

describe("pi-kits path helpers", () => {
  it("uses the global pi agent kits catalog", () => {
    expect(AGENT_ROOT).toBe(expectedAgentRoot);
    expect(CATALOG_ROOT).toBe(`${expectedAgentRoot}/kits`);
  });

  it("derives project-local .pi paths from the current working directory", () => {
    expect(getStatusPaths("/tmp/example-project")).toEqual({
      catalogRoot: `${expectedAgentRoot}/kits`,
      projectRoot: "/tmp/example-project",
      projectPiDir: "/tmp/example-project/.pi",
      projectSettingsPath: "/tmp/example-project/.pi/settings.json",
      manifestPath: "/tmp/example-project/.pi/kits.json",
    });
  });

  it("supports explicit path resolution for future scanner code", () => {
    expect(resolveKitsPaths({
      cwd: "/tmp/example-project",
      agentDir: "/tmp/pi-agent",
    })).toEqual({
      agentDir: "/tmp/pi-agent",
      catalogPath: "/tmp/pi-agent/kits",
      projectPiPath: "/tmp/example-project/.pi",
      projectSettingsPath: "/tmp/example-project/.pi/settings.json",
      globalSettingsPath: "/tmp/pi-agent/settings.json",
    });
  });

  it("formats read-only status output with catalog and project paths", () => {
    const status = formatKitsStatus(getStatusPaths("/tmp/example-project"));

    expect(status).toContain("Pi Kits status");
    expect(status).toContain(`Catalog: ${expectedAgentRoot}/kits`);
    expect(status).toContain("Project .pi: /tmp/example-project/.pi");
    expect(status).toContain("Project settings: /tmp/example-project/.pi/settings.json");
    expect(status).toContain("Manifest: /tmp/example-project/.pi/kits.json");
  });
});
