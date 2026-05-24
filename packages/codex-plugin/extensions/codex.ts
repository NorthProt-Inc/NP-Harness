import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMPANION = join(PLUGIN_ROOT, "scripts", "codex-companion.mjs");
const DATA_DIR = join(homedir(), ".pi", "agent", "codex-plugin-data");
const LONG_TIMEOUT_MS = 60 * 60 * 1000;
const REVIEW_TIMEOUT_MS = 30 * 60 * 1000;
const SETUP_TIMEOUT_MS = 10 * 60 * 1000;

interface ExecResult {
	stdout: string;
	stderr: string;
	code: number | null;
	signal: NodeJS.Signals | null;
}

type CommandContextLike = ExtensionCommandContext & {
	sessionManager: ExtensionCommandContext["sessionManager"] & {
		getSessionFile?: () => string | undefined;
	};
};

function splitRawArgumentString(raw: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: string | null = null;
	let escaping = false;

	for (const character of raw) {
		if (escaping) {
			current += character;
			escaping = false;
			continue;
		}
		if (character === "\\") {
			escaping = true;
			continue;
		}
		if (quote) {
			if (character === quote) quote = null;
			else current += character;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
			continue;
		}
		if (/\s/.test(character)) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}
		current += character;
	}

	if (escaping) current += "\\";
	if (current) tokens.push(current);
	return tokens;
}

function removeFlags(tokens: string[], flags: string[]): string[] {
	const flagSet = new Set(flags);
	return tokens.filter((token) => !flagSet.has(token));
}

function hasAnyFlag(tokens: string[], flags: string[]): boolean {
	const flagSet = new Set(flags);
	return tokens.some((token) => flagSet.has(token));
}

function envFor(ctx: CommandContextLike): NodeJS.ProcessEnv {
	mkdirSync(DATA_DIR, { recursive: true });
	const sessionFile = ctx.sessionManager.getSessionFile?.();
	const sessionId = sessionFile ? `pi:${sessionFile}` : `pi:${ctx.cwd}`;
	return {
		...process.env,
		CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
		CLAUDE_PLUGIN_DATA: DATA_DIR,
		CODEX_COMPANION_SESSION_ID: sessionId,
	};
}

function runProcess(
	command: string,
	args: string[],
	ctx: CommandContextLike,
	timeoutMs: number,
): Promise<ExecResult> {
	return new Promise((resolveResult) => {
		const child = spawn(command, args, {
			cwd: ctx.cwd,
			env: envFor(ctx),
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
		}, timeoutMs);
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("close", (code, signal) => {
			clearTimeout(timer);
			resolveResult({ stdout, stderr, code, signal });
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			resolveResult({ stdout, stderr: String(error), code: 1, signal: null });
		});
	});
}

function runCompanion(
	ctx: CommandContextLike,
	subcommand: string,
	args: string[],	timeoutMs = LONG_TIMEOUT_MS,
): Promise<ExecResult> {
	return runProcess(process.execPath, [COMPANION, subcommand, ...args], ctx, timeoutMs);
}

function spawnDetachedCompanion(ctx: CommandContextLike, subcommand: string, args: string[]): void {
	const child = spawn(process.execPath, [COMPANION, subcommand, ...args], {
		cwd: ctx.cwd,
		env: envFor(ctx),
		detached: true,
		stdio: "ignore",
		windowsHide: true,
	});
	child.unref();
}

function display(pi: ExtensionAPI, title: string, resultOrText: ExecResult | string, kind = "info"): void {
	const body = typeof resultOrText === "string"
		? resultOrText
		: [resultOrText.stdout.trimEnd(), resultOrText.stderr.trimEnd()].filter(Boolean).join("\n\n");
	pi.sendMessage({
		customType: "codex-output",
		content: body || "(no output)",
		display: true,
		details: { title, kind, timestamp: Date.now() },
	});
}

function formatSetupReport(report: any): string {
	const lines = ["# Codex setup", ""];
	lines.push(`- ready: ${report?.ready ? "yes" : "no"}`);
	lines.push(`- node: ${report?.node?.available ? report.node.version ?? "available" : "missing"}`);
	lines.push(`- npm: ${report?.npm?.available ? report.npm.version ?? "available" : "missing"}`);
	lines.push(`- codex: ${report?.codex?.available ? report.codex.version ?? "available" : "missing"}`);
	lines.push(`- auth: ${report?.auth?.loggedIn ? "logged in" : report?.auth?.detail ?? "not logged in"}`);
	lines.push(`- review gate config: ${report?.reviewGateEnabled ? "enabled" : "disabled"}`);
	if (Array.isArray(report?.actionsTaken) && report.actionsTaken.length > 0) {
		lines.push("", "Actions:", ...report.actionsTaken.map((item: string) => `- ${item}`));
	}
	if (Array.isArray(report?.nextSteps) && report.nextSteps.length > 0) {
		lines.push("", "Next steps:", ...report.nextSteps.map((item: string) => `- ${item}`));
	}
	lines.push("", "Note: Pi port does not enforce Claude Code's hard Stop review gate automatically.");
	return `${lines.join("\n")}\n`;
}

function parseJson<T>(text: string): T | null {
	try {
		return JSON.parse(text) as T;
	} catch {
		return null;
	}
}

async function maybeInstallCodex(pi: ExtensionAPI, ctx: CommandContextLike, report: any): Promise<void> {
	if (report?.codex?.available || !report?.npm?.available || !ctx.hasUI) return;
	const ok = await ctx.ui.confirm(
		"Install Codex?",
		"Codex CLI is missing. Install globally with npm install -g @openai/codex?",
	);
	if (!ok) return;
	display(pi, "Codex setup", "Installing Codex CLI...", "info");
	const install = await runProcess("npm", ["install", "-g", "@openai/codex"], ctx, SETUP_TIMEOUT_MS);
	if (install.code !== 0) display(pi, "Codex install failed", install, "error");
}

async function handleSetup(pi: ExtensionAPI, args: string, ctx: CommandContextLike): Promise<void> {
	let tokens = splitRawArgumentString(args);
	if (!tokens.includes("--json")) tokens = [...tokens, "--json"];
	let result = await runCompanion(ctx, "setup", tokens, SETUP_TIMEOUT_MS);
	let report = parseJson<any>(result.stdout);
	if (report) {
		await maybeInstallCodex(pi, ctx, report);
		result = await runCompanion(ctx, "setup", tokens, SETUP_TIMEOUT_MS);
		report = parseJson<any>(result.stdout);
	}
	display(pi, "Codex setup", report ? formatSetupReport(report) : result, result.code === 0 ? "info" : "error");
}

async function gitOutput(ctx: CommandContextLike, args: string[]): Promise<string> {
	const result = await runProcess("git", args, ctx, 10_000);
	return result.code === 0 ? result.stdout.trim() : "";
}

async function recommendReviewMode(ctx: CommandContextLike): Promise<"wait" | "background"> {
	const status = await gitOutput(ctx, ["status", "--short", "--untracked-files=all"]);
	const cached = await gitOutput(ctx, ["diff", "--shortstat", "--cached"]);
	const unstaged = await gitOutput(ctx, ["diff", "--shortstat"]);
	const changedLines = status.split(/\r?\n/).filter(Boolean).length;
	const short = `${cached} ${unstaged}`;
	const fileMatch = short.match(/(\d+)\s+files? changed/);
	const fileCount = fileMatch ? Number(fileMatch[1]) : changedLines;
	return changedLines <= 2 && fileCount <= 2 ? "wait" : "background";
}

async function handleReview(
	pi: ExtensionAPI,
	args: string,
	ctx: CommandContextLike,
	subcommand: "review" | "adversarial-review",
): Promise<void> {
	const rawTokens = splitRawArgumentString(args);
	const hasWait = hasAnyFlag(rawTokens, ["--wait"]);
	const hasBackground = hasAnyFlag(rawTokens, ["--background"]);
	let mode: "wait" | "background" = hasBackground ? "background" : "wait";
	if (!hasWait && !hasBackground) {
		const recommended = await recommendReviewMode(ctx);
		if (ctx.hasUI) {
			const first = recommended === "background" ? "Run in background (Recommended)" : "Wait for results (Recommended)";
			const second = recommended === "background" ? "Wait for results" : "Run in background";
			const choice = await ctx.ui.select("Run Codex review", [first, second]);
			mode = choice?.startsWith("Run in background") ? "background" : "wait";
		} else {
			mode = recommended;
		}
	}

	const tokens = removeFlags(rawTokens, ["--wait", "--background"]);
	if (mode === "background") {
		spawnDetachedCompanion(ctx, subcommand, tokens);
		display(pi, `Codex ${subcommand}`, `Codex ${subcommand} started in the background. Check /codex:status for progress.`, "info");
		return;
	}
	const result = await runCompanion(ctx, subcommand, tokens, REVIEW_TIMEOUT_MS);
	display(pi, `Codex ${subcommand}`, result, result.code === 0 ? "info" : "error");
}

function shouldDefaultWrite(tokens: string[]): boolean {
	if (tokens.includes("--write")) return false;
	const text = tokens.join(" ").toLowerCase();
	const readonlyHints = ["read-only", "readonly", "review", "diagnose", "diagnosis", "investigate", "research", "plan", "검토", "리뷰", "진단", "조사", "분석", "계획"];
	return !readonlyHints.some((hint) => text.includes(hint));
}

async function handleRescue(pi: ExtensionAPI, args: string, ctx: CommandContextLike): Promise<void> {
	let tokens = splitRawArgumentString(args);
	if (tokens.length === 0 && ctx.hasUI) {
		const prompt = await ctx.ui.input("Codex rescue", "What should Codex investigate or fix?");
		if (!prompt?.trim()) return;
		tokens = splitRawArgumentString(prompt);
	}
	const wantsWait = tokens.includes("--wait");
	const hasResumeChoice = hasAnyFlag(tokens, ["--resume", "--resume-last", "--fresh"]);
	tokens = removeFlags(tokens, ["--wait"]);
	if (shouldDefaultWrite(tokens)) tokens = ["--write", ...tokens];
	if (!hasResumeChoice) {
		const candidateResult = await runCompanion(ctx, "task-resume-candidate", ["--json"], 30_000);
		const candidate = parseJson<any>(candidateResult.stdout);
		if (candidate?.available && ctx.hasUI) {
			const choice = await ctx.ui.select("Resume previous Codex thread?", ["Start a new Codex thread (Recommended)", "Continue current Codex thread"]);
			if (choice?.startsWith("Continue")) tokens = ["--resume-last", ...tokens];
			else tokens = ["--fresh", ...tokens];
		}
	}
	const result = await runCompanion(ctx, "task", tokens, wantsWait ? LONG_TIMEOUT_MS : LONG_TIMEOUT_MS);
	display(pi, "Codex rescue", result, result.code === 0 ? "info" : "error");
}

async function handleSimple(
	pi: ExtensionAPI,
	args: string,
	ctx: CommandContextLike,
	subcommand: "status" | "result" | "cancel",
): Promise<void> {
	const timeout = subcommand === "status" ? REVIEW_TIMEOUT_MS : SETUP_TIMEOUT_MS;
	const result = await runCompanion(ctx, subcommand, splitRawArgumentString(args), timeout);
	display(pi, `Codex ${subcommand}`, result, result.code === 0 ? "info" : "error");
}

export default function register(pi: ExtensionAPI): void {
	pi.registerMessageRenderer("codex-output", (message, _options, theme) => {
		const details = message.details as { title?: string; kind?: string } | undefined;
		const color = details?.kind === "error" ? "error" : "accent";
		const title = details?.title ?? "Codex";
		return new Text(`${theme.fg(color, title)}\n${message.content}`, 0, 0);
	});

	if (!existsSync(COMPANION)) {
		console.warn(`[codex-pi] Missing companion script: ${COMPANION}`);
	}

	pi.registerCommand("codex:setup", {
		description: "Check Codex CLI readiness and auth",
		handler: async (args, ctx) => handleSetup(pi, args, ctx as CommandContextLike),
	});
	pi.registerCommand("codex:review", {
		description: "Run a Codex review against local git state",
		handler: async (args, ctx) => handleReview(pi, args, ctx as CommandContextLike, "review"),
	});
	pi.registerCommand("codex:adversarial-review", {
		description: "Run an adversarial Codex review",
		handler: async (args, ctx) => handleReview(pi, args, ctx as CommandContextLike, "adversarial-review"),
	});
	pi.registerCommand("codex:rescue", {
		description: "Delegate a task or investigation to Codex",
		handler: async (args, ctx) => handleRescue(pi, args, ctx as CommandContextLike),
	});
	pi.registerCommand("codex:status", {
		description: "Show active and recent Codex jobs",
		handler: async (args, ctx) => handleSimple(pi, args, ctx as CommandContextLike, "status"),
	});
	pi.registerCommand("codex:result", {
		description: "Show stored final output for a Codex job",
		handler: async (args, ctx) => handleSimple(pi, args, ctx as CommandContextLike, "result"),
	});
	pi.registerCommand("codex:cancel", {
		description: "Cancel an active Codex background job",
		handler: async (args, ctx) => handleSimple(pi, args, ctx as CommandContextLike, "cancel"),
	});
}
