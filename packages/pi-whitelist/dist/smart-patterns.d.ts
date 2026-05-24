/**
 * Smart pattern generation for "Allow always" suggestions.
 *
 * Parses command structure (verb, subcommand, args) and path structure
 * to offer graduated specificity levels instead of a single naive pattern.
 */
/**
 * Parse a bash command and return graduated pattern suggestions.
 * Returns patterns from most specific to most broad.
 */
export declare function suggestBashPatterns(command: string): SmartPattern[];
/**
 * Parse a file path and return graduated pattern suggestions.
 */
export declare function suggestFilePatterns(filePath: string): SmartPattern[];
/**
 * Generate the default pattern (used for "Allow always" quick option).
 * Returns the most specific smart pattern, falling back to simple heuristic.
 */
export declare function generateSmartDefault(toolName: string, ruleContent: string | undefined): string | undefined;
export interface SmartPattern {
    pattern: string;
    scope: 'exact' | 'specific' | 'broad';
    label: string;
}
//# sourceMappingURL=smart-patterns.d.ts.map