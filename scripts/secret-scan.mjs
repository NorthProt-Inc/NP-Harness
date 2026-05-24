#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv[2] || process.cwd();
const skip = new Set([".git", "node_modules", "sessions", "logs", "backups", "memory", ".remember", "codex-plugin-data"]);
const patterns = [
  ["OpenAI/Anthropic-style key", /sk-(?!xxxx)[A-Za-z0-9_-]{20,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{20,}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9_]{20,}/],
  ["Private key block", /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/],
  ["Local user path", /\/home\/cyan\b/],
  ["Personal email", /cyan@northprot\.com/i],
  ["Personal name", /Jongmin Lee/i],
];
const allow = new Set([
  "packages/magnusprot/skills/security-dev/SKILL.md:OpenAI/Anthropic-style key",
  "scripts/secret-scan.mjs:Local user path",
  "scripts/secret-scan.mjs:Personal email",
  "scripts/secret-scan.mjs:Personal name",
]);
const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path);
    else if (st.isFile()) scan(path);
  }
}
function scan(path) {
  let text;
  try {
    const buf = readFileSync(path);
    if (buf.subarray(0, 4096).includes(0)) return;
    text = buf.toString("utf8");
  } catch {
    return;
  }
  const rel = relative(root, path);
  for (const [label, pattern] of patterns) {
    if (allow.has(`${rel}:${label}`)) continue;
    if (pattern.test(text)) hits.push(`${rel}: ${label}`);
  }
}
walk(root);
if (hits.length) {
  console.error("Secret/public-safety scan failed:");
  for (const hit of hits) console.error(`- ${hit}`);
  process.exit(1);
}
console.log("Secret/public-safety scan passed");
