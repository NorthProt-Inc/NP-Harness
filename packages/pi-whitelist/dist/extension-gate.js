import { checkDangerousOverride } from './dangerous-override.js';
import { evaluatePlanMode } from './plan-mode.js';
import { shouldTripCriticalCircuitBreaker } from './circuit-breaker.js';
import { getKnownToolNameFamily } from './tool-names.js';
export function extractRuleContent(toolName, input = {}) {
    const family = getKnownToolNameFamily(toolName);
    if (family === 'bash') {
        return input.command ?? undefined;
    }
    if (family === 'edit' || family === 'write' || family === 'read') {
        return input.path ?? input.file_path ?? undefined;
    }
    return undefined;
}
function block(toolName, ruleContent, reason) {
    return { kind: 'block', toolName, ruleContent, reason };
}
function actionFromDangerous(toolName, ruleContent, decision, hasUI) {
    if (decision.behavior === 'deny') {
        return block(toolName, ruleContent, decision.message ?? `Dangerous command denied: ${toolName}`);
    }
    if (!hasUI) {
        return block(toolName, ruleContent, decision.message ?? `Dangerous command: ${toolName}`);
    }
    return { kind: 'dangerous-prompt', toolName, ruleContent, decision };
}
function actionFromDecision(toolName, ruleContent, decision, hasUI) {
    if (decision.behavior === 'allow') {
        return { kind: 'allow', toolName, ruleContent };
    }
    if (decision.behavior === 'deny') {
        return block(toolName, ruleContent, decision.message ?? `Denied by whitelist: ${toolName}`);
    }
    if (!hasUI) {
        return block(toolName, ruleContent, `Whitelist gate: no UI to confirm ${toolName}${ruleContent ? ` (${ruleContent})` : ''}`);
    }
    return { kind: 'permission-prompt', toolName, ruleContent, decision };
}
export function hasExplicitDeny(manager, input) {
    return manager.hasMatchingRule(input, 'deny');
}
export function evaluateToolCallGate(event, manager, options = {}) {
    const toolName = event.toolName;
    const ruleContent = extractRuleContent(toolName, event.input);
    const hasUI = options.hasUI ?? true;
    const input = { toolName, ruleContent };
    const mode = manager.getMode();
    if (mode === 'bypassPermissions') {
        if (shouldTripCriticalCircuitBreaker(toolName, ruleContent)) {
            return block(toolName, ruleContent, `Critical circuit breaker blocked ${toolName}${ruleContent ? ` (${ruleContent})` : ''}`);
        }
        return { kind: 'allow', toolName, ruleContent };
    }
    if (hasExplicitDeny(manager, input)) {
        const decision = manager.check(input);
        const reason = decision.behavior === 'deny'
            ? decision.message ?? `Denied by whitelist: ${toolName}`
            : `Permission denied for ${toolName}: ${ruleContent ?? 'any'}`;
        return block(toolName, ruleContent, reason);
    }
    if (mode === 'plan') {
        const planOutcome = evaluatePlanMode(toolName, ruleContent);
        if (planOutcome.kind === 'deny') {
            return block(toolName, ruleContent, planOutcome.reason);
        }
        const dangerousOverride = checkDangerousOverride(toolName, ruleContent);
        if (dangerousOverride) {
            return actionFromDangerous(toolName, ruleContent, dangerousOverride, hasUI);
        }
        return { kind: 'allow', toolName, ruleContent };
    }
    const dangerousOverride = checkDangerousOverride(toolName, ruleContent);
    if (dangerousOverride) {
        return actionFromDangerous(toolName, ruleContent, dangerousOverride, hasUI);
    }
    return actionFromDecision(toolName, ruleContent, manager.check(input), hasUI);
}
//# sourceMappingURL=extension-gate.js.map