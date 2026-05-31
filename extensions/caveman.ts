import { constants } from "node:fs";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const piDir = join(homedir(), ".pi", "agent");
const flagPath = join(piDir, ".caveman-active");
const validModes = new Set(["off", "lite", "full", "ultra", "wenyan-lite", "wenyan", "wenyan-full", "wenyan-ultra"]);

type CavemanMode = "lite" | "full" | "ultra" | "wenyan-lite" | "wenyan" | "wenyan-full" | "wenyan-ultra";

function normalizeMode(mode: string | undefined): CavemanMode | undefined {
	const value = mode?.trim().toLowerCase();
	if (!value || value === "off") return undefined;
	return validModes.has(value) ? (value as CavemanMode) : undefined;
}

async function readMode(): Promise<CavemanMode | undefined> {
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(flagPath, constants.O_RDONLY | constants.O_NOFOLLOW);
		const stat = await handle.stat();
		if (!stat.isFile() || stat.size > 64) return undefined;
		const buffer = Buffer.alloc(Math.min(stat.size, 64));
		const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
		return normalizeMode(buffer.toString("utf8", 0, bytesRead));
	} catch {
		return undefined;
	} finally {
		await handle?.close().catch(() => undefined);
	}
}

async function writeMode(mode: CavemanMode): Promise<void> {
	await mkdir(dirname(flagPath), { recursive: true });
	const tempPath = join(piDir, `.caveman-active.${process.pid}.${Date.now()}`);
	await writeFile(tempPath, mode, { mode: 0o600, flag: "wx" });
	await rename(tempPath, flagPath);
}

async function clearMode(): Promise<void> {
	await rm(flagPath, { force: true });
}

function modeFromSlash(text: string): CavemanMode | "off" | undefined {
	const match = /^\/caveman(?:\s+(\S+))?\s*$/i.exec(text.trim());
	if (!match) return undefined;
	const arg = match[1]?.toLowerCase();
	if (!arg) return "full";
	if (["off", "stop", "disable"].includes(arg)) return "off";
	return normalizeMode(arg);
}

function isNaturalActivation(text: string): boolean {
	return (
		/\b(activate|enable|turn on|start|talk like)\b.*\bcaveman\b/i.test(text) ||
		/\bcaveman\b.*\b(mode|activate|enable|turn on|start)\b/i.test(text)
	);
}

function isNaturalDeactivation(text: string): boolean {
	return (
		/\b(stop|disable|deactivate|turn off)\b.*\bcaveman\b/i.test(text) ||
		/\bcaveman\b.*\b(stop|disable|deactivate|turn off)\b/i.test(text) ||
		/\bnormal mode\b/i.test(text)
	);
}

function reinforcement(mode: CavemanMode): string {
	const wenyan = mode.startsWith("wenyan")
		? "\nWenyan mode: use terse semi-classical/classical Chinese register; preserve technical terms, code symbols, function names, API names, and error strings exactly."
		: "";
	return `\n\n## Caveman Mode Active\nCAVEMAN MODE ACTIVE (${mode}). Respond terse while preserving technical accuracy.\nDrop filler, hedging, pleasantries. Fragments OK. Code, commits, security warnings,\nand irreversible action confirmations stay normal and unambiguous. Off only when user\nsays "stop caveman" or "normal mode".${wenyan}`;
}

function notify(ctx: { hasUI?: boolean; ui?: { notify?: (message: string, level?: "info" | "warning" | "error") => void } }, message: string) {
	if (ctx.hasUI) ctx.ui?.notify?.(message, "info");
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" as const };

		const slashMode = modeFromSlash(event.text);
		if (slashMode) {
			if (slashMode === "off") {
				await clearMode();
				pi.events.emit("caveman:mode", { mode: null });
				notify(ctx, "Caveman mode disabled.");
				return { action: "handled" as const };
			}
			await writeMode(slashMode);
			pi.events.emit("caveman:mode", { mode: slashMode });
			notify(ctx, `Caveman mode active: ${slashMode}.`);
			return { action: "handled" as const };
		}

		if (isNaturalDeactivation(event.text)) {
			await clearMode();
			pi.events.emit("caveman:mode", { mode: null });
			return { action: "continue" as const };
		}

		if (isNaturalActivation(event.text)) {
			await writeMode("full");
			pi.events.emit("caveman:mode", { mode: "full" });
		}

		return { action: "continue" as const };
	});

	pi.on("before_agent_start", async (event) => {
		const mode = await readMode();
		if (!mode) return undefined;
		return { systemPrompt: event.systemPrompt + reinforcement(mode) };
	});
}
