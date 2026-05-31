import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const togglePath = join(homedir(), ".pi", "agent", "campaign-loop.active");
const noProgressLimit = 3;
const defaultMaxIterations = 15;

type Campaign = {
	campaign_id?: string;
	project?: string;
	current_phase?: string;
	current_sprint?: number | string;
	total_sprints?: number | string;
	completed_sprints?: Array<number | string>;
	continuation_prompt?: string;
	blocked_reason?: string | null;
	updated?: string;
	started?: string;
	metadata?: { verify_command?: string };
};

type Sprint = {
	verify_command?: string;
	skills?: string[];
	required_skills?: string[];
};

type LoopState = {
	iteration: number;
	max_iterations: number;
	loop_session_id: string;
	last_progress_hash: string;
	no_progress_count: number;
};

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function readJson<T>(path: string): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(path, "utf8")) as T;
	} catch {
		return undefined;
	}
}

async function writeJson(path: string, value: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function updatedKey(campaign: Campaign): string {
	return campaign.updated ?? campaign.started ?? "0";
}

async function findCampaign(cwd: string): Promise<{ file: string; dir: string; data: Campaign } | undefined> {
	const campaignsDir = join(cwd, ".pi", "campaigns");
	let entries: Array<{ file: string; dir: string; data: Campaign }> = [];
	try {
		for (const dirent of await readdir(campaignsDir, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue;
			const dir = join(campaignsDir, dirent.name);
			const file = join(dir, "campaign.json");
			const data = await readJson<Campaign>(file);
			if (data?.current_phase) entries.push({ file, dir, data });
		}
	} catch {
		return undefined;
	}

	entries = entries.sort((a, b) => updatedKey(b.data).localeCompare(updatedKey(a.data)));
	return entries.find((entry) => entry.data.current_phase !== "complete") ?? entries.find((entry) => entry.data.current_phase === "complete");
}

function progressHash(campaign: Campaign): string {
	const sprint = campaign.current_sprint ?? "?";
	const completed = campaign.completed_sprints?.length ?? 0;
	const phase = campaign.current_phase ?? "";
	return `${sprint}:${completed}:${phase}`;
}

function sprintFile(campaignDir: string, sprint: number | string): string {
	const numeric = typeof sprint === "number" || /^\d+$/.test(String(sprint));
	const name = numeric ? String(sprint).padStart(3, "0") : String(sprint);
	return join(campaignDir, "sprints", `${name}.json`);
}

async function getVerifyCommand(campaignDir: string, campaign: Campaign): Promise<string | undefined> {
	const sprint =
		campaign.current_phase === "complete"
			? (campaign.completed_sprints?.at(-1) ?? campaign.current_sprint ?? 1)
			: (campaign.current_sprint ?? campaign.completed_sprints?.at(-1) ?? 1);
	const sprintData = await readJson<Sprint>(sprintFile(campaignDir, sprint));
	return sprintData?.verify_command ?? campaign.metadata?.verify_command;
}

async function getSprintSkills(campaignDir: string, campaign: Campaign): Promise<string> {
	const sprint = campaign.current_sprint ?? 1;
	const sprintData = await readJson<Sprint>(sprintFile(campaignDir, sprint));
	return [...(sprintData?.skills ?? []), ...(sprintData?.required_skills ?? [])].join(" ").trim();
}

function sessionId(ctx: { sessionManager: { getSessionFile: () => string | undefined } }): string {
	return ctx.sessionManager.getSessionFile() ?? "ephemeral";
}

function normalizeState(value: Partial<LoopState> | undefined): LoopState {
	return {
		iteration: Number.isFinite(value?.iteration) ? Number(value?.iteration) : 0,
		max_iterations: Number.isFinite(value?.max_iterations) ? Number(value?.max_iterations) : defaultMaxIterations,
		loop_session_id: typeof value?.loop_session_id === "string" ? value.loop_session_id : "",
		last_progress_hash: typeof value?.last_progress_hash === "string" ? value.last_progress_hash : "",
		no_progress_count: Number.isFinite(value?.no_progress_count) ? Number(value?.no_progress_count) : 0,
	};
}

async function notifyAndStop(ctx: { hasUI?: boolean; ui?: { notify?: (message: string, level?: "info" | "warning" | "error") => void } }, message: string, level: "info" | "warning" | "error" = "warning") {
	await rm(togglePath, { force: true }).catch(() => undefined);
	if (ctx.hasUI) ctx.ui?.notify?.(message, level);
}

async function advanceLoopState(
	ctx: { hasUI?: boolean; ui?: { notify?: (message: string, level?: "info" | "warning" | "error") => void } },
	statePath: string,
	state: LoopState,
	campaign: Campaign,
	campaignId: string,
): Promise<LoopState | undefined> {
	const currentHash = progressHash(campaign);
	const sprint = campaign.current_sprint ?? "?";
	const nextState = {
		...state,
		no_progress_count: currentHash === state.last_progress_hash ? state.no_progress_count + 1 : 0,
	};

	if (nextState.no_progress_count >= noProgressLimit) {
		await writeJson(statePath, { ...nextState, last_progress_hash: currentHash });
		await notifyAndStop(
			ctx,
			`[campaign-loop] ${campaignId} made no progress for ${noProgressLimit} consecutive checks (stuck at sprint ${sprint}) — halting.`,
			"warning",
		);
		return undefined;
	}

	if (nextState.iteration >= nextState.max_iterations) {
		await writeJson(statePath, { ...nextState, last_progress_hash: currentHash });
		await notifyAndStop(ctx, `[campaign-loop] ${campaignId} hit max iterations (${nextState.max_iterations}) — halting.`, "warning");
		return undefined;
	}

	const advanced = {
		...nextState,
		iteration: nextState.iteration + 1,
		last_progress_hash: currentHash,
	};
	await writeJson(statePath, advanced);
	return advanced;
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async (_event, ctx) => {
		if (!(await pathExists(togglePath))) return;
		if (!ctx.cwd) return;

		const found = await findCampaign(ctx.cwd);
		if (!found) {
			await notifyAndStop(ctx, "[campaign-loop] No .pi/campaigns campaign found; disabling loop.", "warning");
			return;
		}

		const { dir: campaignDir, data: campaign } = found;
		const campaignId = campaign.campaign_id ?? basename(campaignDir);
		const phase = campaign.current_phase ?? "";
		const sprint = campaign.current_sprint ?? "?";
		const total = campaign.total_sprints ?? "?";
		const completedCount = campaign.completed_sprints?.length ?? 0;
		const owner = sessionId(ctx);
		const statePath = join(campaignDir, ".loop-state");
		let state = normalizeState(await readJson<Partial<LoopState>>(statePath));

		if (!state.loop_session_id) {
			state = { ...state, loop_session_id: owner };
			await writeJson(statePath, state);
		} else if (state.loop_session_id !== owner) {
			return;
		}

		if (phase === "blocked") {
			await notifyAndStop(
				ctx,
				`[campaign-loop] ${campaignId} is blocked: ${campaign.blocked_reason ?? "no reason recorded"} — stopping, needs human.`,
				"warning",
			);
			return;
		}

		if (phase === "complete") {
			const verifyCommand = await getVerifyCommand(campaignDir, campaign);
			if (verifyCommand) {
				const result = await pi.exec(
					"bash",
					["-lc", 'cd "$1" && bash -lc "$2"', "bash", ctx.cwd, verifyCommand],
					{ timeout: 60_000 },
				).catch(() => ({ code: 1 }));
				if (result.code === 0) {
					await notifyAndStop(ctx, `[campaign-loop] ${campaignId} complete — verify passed.`, "info");
					return;
				}
				state = await advanceLoopState(ctx, statePath, state, campaign, campaignId);
				if (!state) return;
				pi.sendUserMessage(
					`[campaign-loop] ${campaignId} is marked complete but the verify command failed: \`${verifyCommand}\`. Re-run execute-flow Step 0, diagnose why verification fails, fix it, and re-verify. Do NOT mark complete until the verify command passes.`,
					{ deliverAs: "followUp" },
				);
				return;
			}
			await notifyAndStop(ctx, `[campaign-loop] ${campaignId} complete — disabling loop.`, "info");
			return;
		}

		state = await advanceLoopState(ctx, statePath, state, campaign, campaignId);
		if (!state) return;

		const sprintSkills = await getSprintSkills(campaignDir, campaign);
		const skillLine = sprintSkills ? ` This sprint needs these skills — invoke them explicitly: ${sprintSkills}.` : "";
		const continuation = campaign.continuation_prompt ?? "";
		const reason = `[campaign-loop] Continue campaign ${campaignId}. Run execute-flow Step 0: re-derive state from .pi/campaigns/${campaignId}/handoff.md and campaign.json — do NOT rely on transcript memory. Goal: ${campaign.project ?? "campaign"}. Advance EXACTLY ONE sprint (currently sprint ${sprint}/${total}, ${completedCount} completed), then stop. Use the *-flow skills; do not improvise.${skillLine} After the sprint, update campaign.json (completed_sprints, current_sprint, updated, continuation_prompt) and .loop-state. Set current_phase=complete ONLY after the sprint verify passes. Current state: ${continuation}`;

		pi.sendUserMessage(reason, { deliverAs: "followUp" });
	});
}
