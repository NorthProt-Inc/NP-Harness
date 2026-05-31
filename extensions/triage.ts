import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const trivialPatterns = [
	/^(fix|correct) (the )?typo/,
	/^rename [a-z_]+ to [a-z_]+/,
	/^add (an? )?import/,
	/^remove unused/,
	/^update (the )?version/,
	/^change [a-z_]+ to [a-z_]+/,
	/^delete (the )?(unused|dead|empty)/,
	/^move [a-z_]+ (to|into)/,
];

const skillMap: Record<string, string> = {
	commit: "commit-dev",
	deploy: "worktree-flow",
	review: "review-anly",
	debug: "debug-anly",
	test: "implement-flow",
	security: "security-dev",
	deps: "deps-dev",
	dependencies: "deps-dev",
	clean: "clean-dev",
	cleanup: "clean-dev",
	health: "healthcheck-dev",
	healthcheck: "healthcheck-dev",
	perf: "perf-anly",
	performance: "perf-anly",
	explain: "explain-anly",
	simplify: "simplify-anly",
	document: "docs-dev",
	docs: "docs-dev",
	plan: "plan-flow",
	brainstorm: "brainstorm-flow",
	migrate: "migration-planner",
	migration: "migration-planner",
	research: "research-sys",
};

async function appendAuditLine(pi: ExtensionAPI, tier: string, prompt: string) {
	await pi.exec(
		"bash",
		[
			"-lc",
			'mkdir -p "$HOME/.pi/agent/logs"; printf "%s %s %s\\n" "$(date -Is)" "$1" "$2" >> "$HOME/.pi/agent/logs/triage-audit.log" 2>/dev/null || true',
			"bash",
			tier,
			prompt.slice(0, 80),
		],
		{ timeout: 5_000 },
	).catch(() => undefined);
}

async function readCampaign(pi: ExtensionAPI, cwd: string) {
	const result = await pi.exec(
		"bash",
		[
			"-lc",
			'latest=$(find "$1/.pi/campaigns" -mindepth 2 -maxdepth 2 -name campaign.json 2>/dev/null | while read -r f; do phase=$(jq -r \'.current_phase // empty\' "$f" 2>/dev/null); [ -z "$phase" ] || [ "$phase" = complete ] && continue; updated=$(jq -r \'.updated // .started // "0"\' "$f" 2>/dev/null); printf "%s\\t%s\\n" "$updated" "$f"; done | sort -r | head -n1 | cut -f2-); if [ -n "$latest" ]; then cat -- "$latest"; exit 0; fi; ' +
				'if [ -f "$1/.pi/campaign.json" ]; then cat -- "$1/.pi/campaign.json"; exit 0; fi; exit 1',
			"bash",
			cwd,
		],
		{ timeout: 5_000 },
	);
	if (result.code !== 0 || !result.stdout.trim()) return undefined;

	try {
		return JSON.parse(result.stdout) as {
			current_phase?: string;
			current_sprint?: string | number;
			total_sprints?: string | number;
			continuation_prompt?: string;
		};
	} catch {
		return undefined;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		const env = (globalThis as typeof globalThis & {
			process?: { env?: Record<string, string | undefined> };
		}).process?.env;
		const triageEffort = env?.PI_TRIAGE_EFFORT ?? env?.CLAUDE_EFFORT ?? "high";
		if (triageEffort === "low") {
			return { action: "continue" };
		}

		const prompt = event.text;
		if (!prompt) {
			return { action: "continue" };
		}

		const promptLower = prompt.toLowerCase().trim();

		for (const pattern of trivialPatterns) {
			if (pattern.test(promptLower)) {
				if (ctx.hasUI) ctx.ui.notify("TRIAGE: T1-trivial — direct execution, skip planning pipeline.", "info");
				await appendAuditLine(pi, "T1", prompt);
				return { action: "continue" };
			}
		}

		if (ctx.cwd) {
			const campaign = await readCampaign(pi, ctx.cwd);
			const phase = campaign?.current_phase ?? "";
			if (phase && phase !== "complete") {
				const sprint = campaign?.current_sprint ?? "?";
				const total = campaign?.total_sprints ?? "?";
				const continuation = campaign?.continuation_prompt ?? "";
				if (ctx.hasUI) {
					ctx.ui.notify(
						`TRIAGE: T2-campaign — active campaign detected (phase=${phase}, sprint=${sprint}/${total}). ${continuation}`,
						"info",
					);
				}
				await appendAuditLine(pi, "T2", prompt);
				return { action: "continue" };
			}
		}

		for (const [keyword, skill] of Object.entries(skillMap)) {
			const keywordPattern = new RegExp(`(^|please |let'?s |run |do )${keyword}\\b`);
			if (keywordPattern.test(promptLower)) {
				if (ctx.hasUI) {
					ctx.ui.notify(`TRIAGE: T3-skill — consider using magnusprot:${skill} for this task.`, "info");
				}
				await appendAuditLine(pi, `T3:${keyword}`, prompt);
				return { action: "continue" };
			}
		}

		return { action: "continue" };
	});
}
