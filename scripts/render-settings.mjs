#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const piAgentDir = process.env.PI_AGENT_DIR || process.env.PI_CODING_AGENT_DIR || `${process.env.HOME}/.pi/agent`;
const home = process.env.HOME || "~";
const template = readFileSync(resolve(root, "settings.template.json"), "utf8");
const rendered = template
  .replaceAll("${PI_AGENT_DIR}", piAgentDir)
  .replaceAll("${HOME}", home);

JSON.parse(rendered);
writeFileSync(resolve(root, "settings.json"), rendered.endsWith("\n") ? rendered : `${rendered}\n`);
console.log(`Rendered settings.json for ${piAgentDir}`);
