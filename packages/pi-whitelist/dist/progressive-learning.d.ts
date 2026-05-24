/**
 * Progressive learning — tracks "Allow once" patterns per session
 * and suggests broader rules when the same prefix is used repeatedly.
 */
export interface PrefixTracker {
    /** Map of command prefix → count of allow-once hits */
    prefixCounts: Map<string, number>;
    /** Threshold to trigger suggestion */
    threshold: number;
    /** Prefixes already suggested (don't suggest again) */
    suggested: Set<string>;
}
export declare function createPrefixTracker(threshold?: number): PrefixTracker;
/**
 * Record a tool invocation that was allowed once.
 * Returns a suggestion if the prefix has hit the threshold.
 *
 * Tracks both the specific prefix (git push) and the base prefix (git).
 * The first to hit threshold wins.
 */
export declare function recordAllowOnce(tracker: PrefixTracker, toolName: string, ruleContent: string | undefined): PrefixSuggestion | null;
export interface PrefixSuggestion {
    /** The common prefix detected */
    prefix: string;
    /** Number of times this prefix was allowed */
    count: number;
    /** The suggested rule string */
    rule: string;
}
//# sourceMappingURL=progressive-learning.d.ts.map