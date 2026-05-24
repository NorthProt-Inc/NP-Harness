/**
 * pi-whitelist — Tool Permission Extension for pi-coding-agent
 *
 * Gates all tool calls through the tri-state permission system (allow/deny/ask).
 * Uses a hybrid prompt: ctx.ui.select() for arrow-key nav + ctx.ui.onTerminalInput()
 * for instant number-key selection (press 1/2/3 without Enter).
 * Supports denyPaths, smart pattern suggestions, progressive learning, and dangerous overrides.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function whitelistExtension(pi: ExtensionAPI): Promise<void>;
//# sourceMappingURL=extension.d.ts.map