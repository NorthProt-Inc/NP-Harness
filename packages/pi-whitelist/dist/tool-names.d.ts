export declare const TOOL_NAME_ALIASES: {
    readonly Bash: "bash";
    readonly bash: "bash";
    readonly FileEdit: "edit";
    readonly fileedit: "edit";
    readonly Edit: "edit";
    readonly edit: "edit";
    readonly FileWrite: "write";
    readonly filewrite: "write";
    readonly Write: "write";
    readonly write: "write";
    readonly Read: "read";
    readonly read: "read";
    readonly FileRead: "read";
    readonly fileread: "read";
    readonly Agent: "agent";
    readonly agent: "agent";
};
export declare const KNOWN_NORMALIZED_TOOL_NAMES: readonly ["bash", "edit", "write", "read", "agent"];
export type ToolNameAlias = keyof typeof TOOL_NAME_ALIASES;
export type KnownNormalizedToolName = (typeof KNOWN_NORMALIZED_TOOL_NAMES)[number];
export type NormalizedToolName = KnownNormalizedToolName | (string & {});
export declare function getKnownToolNameFamily(toolName: string): KnownNormalizedToolName | undefined;
export declare function getMatcherToolName(toolName: string): string;
export declare function normalizeToolName(toolName: string): NormalizedToolName;
//# sourceMappingURL=tool-names.d.ts.map