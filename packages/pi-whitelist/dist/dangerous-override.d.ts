/**
 * Dangerous override — always re-prompt for dangerous commands,
 * even if an allow rule exists. This prevents broad patterns like
 * Bash(git *) from accidentally allowing Bash(rm -rf /).
 *
 * Uses glob matching for path patterns and prefix matching for command patterns.
 */
import type { PermissionAskDecision, PermissionDenyDecision, PermissionRuleValue } from './types/index.js';
export declare const DANGEROUS_PATTERNS: readonly PermissionRuleValue[];
/**
 * Check if a tool invocation matches a dangerous pattern.
 * If so, return an ask decision that forces re-prompting.
 */
export declare function checkDangerousOverride(toolName: string, ruleContent: string | undefined): PermissionAskDecision | PermissionDenyDecision | null;
//# sourceMappingURL=dangerous-override.d.ts.map