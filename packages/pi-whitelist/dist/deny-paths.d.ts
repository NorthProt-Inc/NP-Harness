/**
 * Expand denyPaths globs into deny rule strings for file tools.
 *
 * @example
 * expandDenyPaths(['.env*'])
 * // → ['Read(.env*)', 'Edit(.env*)', 'Write(.env*)', 'read(.env*)', 'edit(.env*)', 'write(.env*)']
 */
/** Tools that operate on file paths — denyPaths expands into deny rules for these */
export declare const FILE_TOOLS: readonly ["Read", "Edit", "Write", "read", "edit", "write"];
export declare function expandDenyPaths(denyPaths: string[]): string[];
//# sourceMappingURL=deny-paths.d.ts.map