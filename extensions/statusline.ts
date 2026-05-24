import { type ExtensionAPI, type ExtensionContext, type Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

type ProbeCache = {
	disk?: string;
	gpu?: string;
	diskAt: number;
	gpuAt: number;
};

type Snapshot = {
	time?: string;
	branch?: string;
	load?: string;
	memory?: string;
	disk?: string;
	gpu?: string;
	context?: string;
	cwd: string;
	model?: string;
};

const refreshDebounceMs = 1_500;
const slowProbeCacheMs = 10_000;
const identity = {
	alias: "np",
	org: "northprot",
	tagline: "carbon × silicon",
	field: "agent harness",
	place: "Milky Way",
};

const workingMessages = [
	"folding carbon into silicon…",
	"resolving the variant topology…",
	"collapsing target to construct…",
	"tracing the frameshift backward…",
	"threading sequence through attention…",
	"sourcing from first principles…",
];

function pickWorkingMessage() {
	return workingMessages[Math.floor(Math.random() * workingMessages.length)];
}

async function shell(pi: ExtensionAPI, command: string, args: string[] = [], timeout = 1_000) {
	try {
		const result = await pi.exec("bash", ["-lc", command, "bash", ...args], { timeout });
		if (result.code !== 0) return undefined;
		const stdout = result.stdout.trim();
		return stdout.length > 0 ? stdout : undefined;
	} catch {
		return undefined;
	}
}

function homeRelative(path: string) {
	const home = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
		?.env?.HOME;
	if (home && path.startsWith(home)) return `~${path.slice(home.length)}`;
	return path || "~";
}

function parseLoad(stdout: string | undefined) {
	return stdout?.match(/load averages?:\s*([0-9.]+)/)?.[1] ?? stdout?.match(/load average:\s*([0-9.]+)/)?.[1];
}

function formatGb(value: number, fractionDigits: number) {
	return (value / 1024 ** 3).toFixed(fractionDigits);
}

function parseMemory(stdout: string | undefined) {
	const mem = stdout
		?.split(/\r?\n/)
		.find((line) => line.startsWith("Mem:"))
		?.trim()
		.split(/\s+/);
	const total = Number(mem?.[1]);
	const used = Number(mem?.[2]);
	if (!Number.isFinite(total) || !Number.isFinite(used)) return undefined;
	return `${formatGb(used, 1)}/${formatGb(total, 1)} GB`;
}

function parseDisk(stdout: string | undefined) {
	const line = stdout?.split(/\r?\n/).find((entry, index) => index > 0 && entry.trim().length > 0);
	const parts = line?.trim().split(/\s+/);
	const total = Number(parts?.[1]);
	const used = Number(parts?.[2]);
	if (!Number.isFinite(total) || !Number.isFinite(used)) return undefined;
	return `${formatGb(used, 0)}/${formatGb(total, 0)} GB`;
}

function parseGpu(stdout: string | undefined) {
	const line = stdout?.split(/\r?\n/).find((entry) => entry.trim().length > 0);
	const [temp, util] = line?.split(",").map((part) => part.trim()) ?? [];
	if (!temp || !util) return undefined;
	return `${temp}°C ${util}%`;
}

function formatContext(ctx: ExtensionContext) {
	const usage = ctx.getContextUsage();
	if (typeof usage?.tokens !== "number" || typeof usage?.percent !== "number") return undefined;
	return `${Math.floor(usage.tokens / 1000)}k/${Math.floor(usage.percent)}%`;
}

async function getBranch(pi: ExtensionAPI, cwd: string) {
	return (await shell(pi, 'git -C "$1" branch --show-current 2>/dev/null', [cwd])) || undefined;
}

async function getDisk(pi: ExtensionAPI, cwd: string, cache: ProbeCache) {
	const now = Date.now();
	if (cache.disk && now - cache.diskAt < slowProbeCacheMs) return cache.disk;
	const stdout = await shell(pi, 'df -B1 "$1" 2>/dev/null || df -B1 /', [cwd || "/"]);
	cache.disk = parseDisk(stdout);
	cache.diskAt = now;
	return cache.disk;
}

async function getGpu(pi: ExtensionAPI, cache: ProbeCache) {
	const now = Date.now();
	if (cache.gpu !== undefined && now - cache.gpuAt < slowProbeCacheMs) return cache.gpu;
	const stdout = await shell(
		pi,
		"nvidia-smi --query-gpu=temperature.gpu,utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -n1",
	);
	cache.gpu = parseGpu(stdout);
	cache.gpuAt = now;
	return cache.gpu;
}

async function buildSnapshot(pi: ExtensionAPI, ctx: ExtensionContext, cache: ProbeCache): Promise<Snapshot> {
	const [time, branch, loadRaw, memoryRaw, disk, gpu] = await Promise.all([
		shell(pi, "date +%H:%M"),
		getBranch(pi, ctx.cwd),
		shell(pi, "uptime"),
		shell(pi, "free -b"),
		getDisk(pi, ctx.cwd, cache),
		getGpu(pi, cache),
	]);

	return {
		time,
		branch,
		load: parseLoad(loadRaw),
		memory: parseMemory(memoryRaw),
		disk,
		gpu,
		context: formatContext(ctx),
		cwd: homeRelative(ctx.cwd),
		model: ctx.model?.id,
	};
}

function pill(theme: Theme, label: string, value?: string, tone: "accent" | "success" | "warning" | "muted" = "muted") {
	if (!value) return undefined;
	return `${theme.fg("dim", label)} ${theme.fg(tone, value)}`;
}

function joinDefined(parts: Array<string | undefined>, sep: string) {
	return parts.filter((part): part is string => Boolean(part)).join(sep);
}

function fit(text: string, width: number) {
	return truncateToWidth(text, Math.max(1, width), "…");
}

function renderDashboard(theme: Theme, snapshot: Snapshot | undefined, width: number): string[] {
	const snap: Snapshot = snapshot ?? { cwd: "~" };
	const handle = `${identity.alias}@${identity.org}`;
	const title = `${theme.fg("borderMuted", "╭─")} ${theme.bold(theme.fg("accent", handle))} ${theme.fg("dim", identity.tagline)}`;
	const right = joinDefined(
		[
			snap.time ? theme.fg("muted", snap.time) : undefined,
			snap.branch ? `${theme.fg("dim", "git ")}${theme.fg("muted", snap.branch)}` : undefined,
			snap.model ? theme.fg("dim", snap.model) : undefined,
		],
		"  ",
	);
	const pad = " ".repeat(Math.max(1, width - visibleWidth(title) - visibleWidth(right)));
	const top = fit(title + pad + right, width);

	const stats = joinDefined(
		[
			pill(theme, "LDA", snap.load),
			pill(theme, "MEM", snap.memory),
			pill(theme, "DISK", snap.disk),
			pill(theme, "GPU", snap.gpu, "warning"),
			pill(theme, "CTX", snap.context, "success"),
		],
		`${theme.fg("dim", " │ ")}`,
	);
	const bottomText = `${theme.fg("borderMuted", "╰─")} ${theme.fg("muted", identity.field)} ${theme.fg("dim", "·")} ${theme.fg("muted", identity.place)} ${theme.fg("dim", "·")} ${theme.fg("muted", snap.cwd)}`;
	const statsLine = stats ? `${bottomText} ${theme.fg("dim", "·")} ${stats}` : bottomText;
	const bottom = fit(statsLine, width);

	return [top, bottom];
}

function applyStaticChrome(ctx: ExtensionContext) {
	ctx.ui.setTheme("vira-graphene-high-contrast");
	const theme = ctx.ui.theme;
	ctx.ui.setWorkingMessage(pickWorkingMessage());
	ctx.ui.setWorkingIndicator({
		frames: [
			theme.fg("dim", "░"),
			theme.fg("muted", "▒"),
			theme.fg("muted", "▓"),
			theme.fg("accent", "█"),
			theme.fg("muted", "▓"),
			theme.fg("dim", "▒"),
		],
		intervalMs: 100,
	});

	ctx.ui.setHeader((_tui, liveTheme) => ({
		invalidate() {},
		render(width: number): string[] {
			const wordmark = liveTheme.bold(liveTheme.fg("accent", identity.org));
			return [fit(wordmark, width)];
		},
	}));
}

function applyDashboard(ctx: ExtensionContext, snapshot: Snapshot | undefined) {
	ctx.ui.setStatus(
		"statusline",
		joinDefined(
			[
				snapshot?.time ? ctx.ui.theme.fg("muted", snapshot.time) : undefined,
				snapshot?.context ? `${ctx.ui.theme.fg("dim", "CTX ")}${ctx.ui.theme.fg("success", snapshot.context)}` : undefined,
			],
			" ",
		),
	);
	ctx.ui.setWidget("statusline", undefined);
	ctx.ui.setFooter((_tui, liveTheme) => ({
		invalidate() {},
		render(width: number): string[] {
			return renderDashboard(liveTheme, snapshot, width);
		},
	}));
}

export default function (pi: ExtensionAPI) {
	const cache: ProbeCache = { gpuAt: 0, diskAt: 0 };
	let lastSnapshot: Snapshot | undefined;
	let lastRefreshAt = 0;
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	let refreshing = false;
	let pendingCtx: ExtensionContext | undefined;

	const clearTimer = () => {
		if (refreshTimer) {
			clearTimeout(refreshTimer);
			refreshTimer = undefined;
		}
	};

	const refresh = async (ctx: ExtensionContext) => {
		if (refreshing) {
			pendingCtx = ctx;
			return;
		}

		refreshing = true;
		try {
			lastSnapshot = await buildSnapshot(pi, ctx, cache);
			if (ctx.hasUI) applyDashboard(ctx, lastSnapshot);
			lastRefreshAt = Date.now();
		} finally {
			refreshing = false;
		}

		if (pendingCtx) {
			const nextCtx = pendingCtx;
			pendingCtx = undefined;
			schedule(nextCtx);
		}
	};

	const schedule = (ctx: ExtensionContext, immediate = false) => {
		if (!ctx.hasUI) return;
		const now = Date.now();
		const wait = immediate || lastRefreshAt === 0 ? 0 : Math.max(0, refreshDebounceMs - (now - lastRefreshAt));
		pendingCtx = ctx;

		if (wait === 0) {
			clearTimer();
			const nextCtx = pendingCtx;
			pendingCtx = undefined;
			if (nextCtx) void refresh(nextCtx);
			return;
		}

		if (refreshTimer) return;
		refreshTimer = setTimeout(() => {
			refreshTimer = undefined;
			const nextCtx = pendingCtx;
			pendingCtx = undefined;
			if (nextCtx) void refresh(nextCtx);
		}, wait);
	};

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			applyStaticChrome(ctx);
			applyDashboard(ctx, lastSnapshot);
		}
		schedule(ctx, true);
	});

	for (const eventName of [
		"input",
		"agent_start",
		"turn_start",
		"message_start",
		"message_update",
		"message_end",
		"turn_end",
		"agent_end",
	] as const) {
		pi.on(eventName, async (_event, ctx) => {
			if (ctx.hasUI && (eventName === "turn_start" || eventName === "agent_start")) {
				ctx.ui.setWorkingMessage(pickWorkingMessage());
			}
			schedule(ctx);
			if (eventName === "input") return { action: "continue" as const };
			return undefined;
		});
	}

	pi.registerCommand("vira-tui", {
		description: "Refresh the Vira Graphene / Cyan TUI chrome.",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			applyStaticChrome(ctx);
			applyDashboard(ctx, lastSnapshot);
			schedule(ctx, true);
			ctx.ui.notify("Vira Graphene TUI refreshed", "info");
		},
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		clearTimer();
		if (ctx.hasUI) {
			ctx.ui.setStatus("statusline", undefined);
			ctx.ui.setWidget("statusline", undefined);
			ctx.ui.setFooter(undefined);
			ctx.ui.setHeader(undefined);
			ctx.ui.setWorkingMessage();
			ctx.ui.setWorkingIndicator();
		}
	});
}
