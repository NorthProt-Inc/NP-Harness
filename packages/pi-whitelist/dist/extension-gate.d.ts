import type { PermissionAskDecision, PermissionDecision, PermissionRuleValue } from './types/index.js';
import { PermissionManager } from './manager.js';
export interface ToolCallEventLike {
    toolName: string;
    input?: Record<string, unknown>;
}
export interface ToolCallGateOptions {
    hasUI?: boolean;
}
export type ToolCallBlock = {
    block: true;
    reason: string;
};
export type ToolCallGateAction = {
    kind: 'allow';
    toolName: string;
    ruleContent: string | undefined;
} | {
    kind: 'block';
    toolName: string;
    ruleContent: string | undefined;
    reason: string;
} | {
    kind: 'dangerous-prompt';
    toolName: string;
    ruleContent: string | undefined;
    decision: PermissionAskDecision;
} | {
    kind: 'permission-prompt';
    toolName: string;
    ruleContent: string | undefined;
    decision: PermissionDecision;
};
export declare function extractRuleContent(toolName: string, input?: Record<string, unknown>): string | undefined;
export declare function hasExplicitDeny(manager: PermissionManager, input: PermissionRuleValue): boolean;
export declare function evaluateToolCallGate(event: ToolCallEventLike, manager: PermissionManager, options?: ToolCallGateOptions): ToolCallGateAction;
//# sourceMappingURL=extension-gate.d.ts.map