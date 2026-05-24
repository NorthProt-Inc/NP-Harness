export interface FrontmatterResult {
  data: Record<string, string>;
  body: string;
}

function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  if (!content.startsWith("---\n") && content.trim() !== "---") {
    return { data: {}, body: content };
  }

  const endMarker = content.indexOf("\n---", 4);
  if (endMarker === -1) {
    return { data: {}, body: content };
  }

  const rawFrontmatter = content.slice(4, endMarker);
  const afterMarkerStart = content.indexOf("\n", endMarker + 1);
  const body = afterMarkerStart === -1 ? "" : content.slice(afterMarkerStart + 1);
  const data: Record<string, string> = {};

  for (const line of rawFrontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf(":");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = stripMatchingQuotes(trimmed.slice(separator + 1));
    if (key) data[key] = value;
  }

  return { data, body };
}
