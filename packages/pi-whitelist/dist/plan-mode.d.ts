export type PlanModeOutcome = {
    kind: 'allow';
} | {
    kind: 'deny';
    reason: string;
};
export declare function isPlanModeBashSafe(command: string): boolean;
export declare function evaluatePlanMode(toolName: string, ruleContent?: string): PlanModeOutcome;
//# sourceMappingURL=plan-mode.d.ts.map