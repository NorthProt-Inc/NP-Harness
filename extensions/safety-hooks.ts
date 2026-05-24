import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const destructiveCommandPatterns = [
		/\brm\b(?=[^\n;&|]*(?:\s-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*\b|\s-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*\b|\s-r\b[^\n;&|]*\s-f\b|\s-f\b[^\n;&|]*\s-r\b|\s--recursive\b[^\n;&|]*\s--force\b|\s--force\b[^\n;&|]*\s--recursive\b))[^\n;&|]*\s\/\S*/i,
		/\bgit\s+push\b[^\n;&|]*(?:--force(?:-with-lease)?|-f)\b/i,
		/\bgit\s+reset\b[^\n;&|]*\s--hard\b/i,
		/\bdrop\s+table\b/i,
		/--no-verify\b/i,
		/--no-gpg-sign\b/i,
	];

	const protectedFilePatterns = [
		/(?:^|\/)\.env(?:\.[^\/]+)?$/,
		/(?:^|\/)secrets(?:\/|$)/,
		/(?:^|\/)\.git(?:\/|$)/,
		/(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
	];

	pi.on("tool_call", async (event) => {
		// VERIFIED-from-docs: tool_call exposes event.toolName.
		if (isToolCallEventType("bash", event)) {
			// VERIFIED-from-docs: bash tool input exposes event.input.command.
			const command = event.input.command;
			if (destructiveCommandPatterns.some((pattern) => pattern.test(command))) {
				return { block: true, reason: "BLOCKED: destructive command detected" };
			}
		}

		// VERIFIED-from-docs: tool_call exposes event.toolName.
		if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
			// VERIFIED-from-docs: write/edit examples use event.input.path.
			const filePath = event.input.path;
			if (protectedFilePatterns.some((pattern) => pattern.test(filePath))) {
				return { block: true, reason: "BLOCKED: protected file pattern matched" };
			}
		}

		return undefined;
	});
}
