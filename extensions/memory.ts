import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const maxText = 2_000;

function truncate(value: string, limit = maxText) {
	return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function oneLine(value: unknown, limit = 220) {
	if (value === undefined || value === null) return "";
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return truncate(text.replace(/\s+/g, " ").trim(), limit);
}

function textFromMessage(message: unknown) {
	const msg = message as { content?: unknown };
	if (typeof msg.content === "string") return msg.content;
	if (!Array.isArray(msg.content)) return "";
	return msg.content
		.filter((part): part is { type: string; text: string } => {
			return typeof part === "object" && part !== null && (part as { type?: unknown }).type === "text";
		})
		.map((part) => part.text)
		.join("\n");
}

async function exec(pi: ExtensionAPI, script: string, args: string[] = [], timeout = 10_000) {
	return pi.exec("bash", ["-lc", script, "bash", ...args], { timeout }).catch(() => undefined);
}

async function loadAutoMemory(pi: ExtensionAPI) {
	const script = String.raw`
set -u
dst="$HOME/.pi/agent/memory"
mkdir -p "$dst"
[ -e "$dst/MEMORY.md" ] || : > "$dst/MEMORY.md"
sed -n '1,200p' "$dst/MEMORY.md" 2>/dev/null
`;
	const result = await exec(pi, script);
	const index = result?.stdout.trim() ?? "";
	if (!index) return "";
	return [
		"=== AUTO MEMORY ===",
		"Source: ~/.pi/agent/memory/MEMORY.md",
		"Frontmatter spec for linked files: name, description, metadata.type or type in {user, feedback, project, reference}.",
		"Index format: '- [Title](file.md) - one-line hook' entries under topic headers.",
		"",
		index,
	].join("\n");
}

async function initRemember(pi: ExtensionAPI, cwd: string) {
	const script = String.raw`
project="$1"
remember="$project/.remember"
if [ ! -d "$remember" ]; then
	mkdir -p "$remember/tmp" "$remember/logs" "$remember/logs/autonomous"
	printf '*\n' > "$remember/.gitignore"
	: > "$remember/now.md"
	: > "$remember/recent.md"
	: > "$remember/archive.md"
fi
`;
	await exec(pi, script, [cwd]);
}

async function maintainRemember(pi: ExtensionAPI, cwd: string) {
	const script = String.raw`
project="$1"
remember="$project/.remember"
today="$(date +%Y-%m-%d)"
mkdir -p "$remember/tmp" "$remember/logs" "$remember/logs/autonomous"
[ -f "$remember/.gitignore" ] || printf '*\n' > "$remember/.gitignore"
: > "$remember/recent.tmp"
printf '# Recent\n\n' > "$remember/recent.tmp"
for file in "$remember"/today-*.md; do
	[ -f "$file" ] || continue
	case "$file" in *.done.md) continue ;; esac
	base="$(basename "$file")"
	day="$(printf '%s' "$base" | sed 's/^today-//; s/\.md$//')"
	age=$(( ( $(date +%s) - $(date -d "$day" +%s 2>/dev/null || date +%s) ) / 86400 ))
	if [ "$age" -lt 7 ]; then
		printf -- '--- %s ---\n' "$base" >> "$remember/recent.tmp"
		cat "$file" >> "$remember/recent.tmp"
		printf '\n' >> "$remember/recent.tmp"
	elif [ "$day" != "$today" ]; then
		[ -s "$remember/archive.md" ] || printf '# Archive\n\n' > "$remember/archive.md"
		printf -- '--- %s ---\n' "$base" >> "$remember/archive.md"
		cat "$file" >> "$remember/archive.md"
		printf '\n' >> "$remember/archive.md"
		done_file="$(printf '%s' "$file" | sed 's/\.md$/.done.md/')"
		mv "$file" "$done_file"
	fi
done
mv "$remember/recent.tmp" "$remember/recent.md"
`;
	await exec(pi, script, [cwd]);
}

async function appendRemember(pi: ExtensionAPI, cwd: string, header: string, body: string) {
	const script = String.raw`
project="$1"
header="$2"
body="$3"
remember="$project/.remember"
day="$(date +%Y-%m-%d)"
mkdir -p "$remember/tmp" "$remember/logs" "$remember/logs/autonomous"
[ -f "$remember/.gitignore" ] || printf '*\n' > "$remember/.gitignore"
entry="$(mktemp "/tmp/pi-remember-entry-XXXXXX")"
{
	printf '\n## %s | %s\n' "$(date +%H:%M)" "$header"
	printf '%s\n' "$body"
} > "$entry"
cat "$entry" >> "$remember/now.md"
cat "$entry" >> "$remember/today-$day.md"
rm -f "$entry"
`;
	await exec(pi, script, [cwd, header, body]);
	await maintainRemember(pi, cwd);
}

function compactionType(event: unknown) {
	const compact = event as { customInstructions?: string };
	return compact.customInstructions ? "manual" : "auto";
}

export default function (pi: ExtensionAPI) {
	let autoMemoryContext = "";
	const toolInputs = new Map<string, string>();

	pi.on("session_start", async (_event, ctx) => {
		autoMemoryContext = await loadAutoMemory(pi);
		if (ctx.cwd) await initRemember(pi, ctx.cwd);
	});

	pi.on("context", (event) => {
		if (!autoMemoryContext) return undefined;
		return {
			messages: [
				{
					role: "user" as const,
					content: autoMemoryContext,
					timestamp: Date.now(),
				},
				...event.messages,
			],
		};
	});

	pi.on("session_before_compact", async (event, ctx) => {
		if (!ctx.cwd) return;
		const type = compactionType(event);
		const stamp = new Date().toISOString();
		await appendRemember(pi, ctx.cwd, "precompact", `Pre-compact marker: timestamp=${stamp} type=${type}`);
	});

	pi.on("tool_call", (event) => {
		toolInputs.set(event.toolCallId, oneLine(event.input, 180));
		return undefined;
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (!ctx.cwd) return;
		const args = toolInputs.get(event.toolCallId) ?? "";
		toolInputs.delete(event.toolCallId);
		const result = oneLine(event.result, 260);
		if (!event.isError && !["bash", "edit", "write"].includes(event.toolName)) return;
		const status = event.isError ? "error" : "ok";
		await appendRemember(pi, ctx.cwd, `tool:${event.toolName}`, `Tool ${event.toolName} ${status}; args=${args}; result=${result}`);
	});

	pi.on("turn_end", async (event, ctx) => {
		if (!ctx.cwd) return;
		const text = oneLine(textFromMessage(event.message), 360);
		if (!text || text.length < 80) return;
		await appendRemember(pi, ctx.cwd, "turn", text);
	});
}
