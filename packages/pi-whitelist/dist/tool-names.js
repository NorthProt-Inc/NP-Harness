export const TOOL_NAME_ALIASES = {
    Bash: 'bash',
    bash: 'bash',
    FileEdit: 'edit',
    fileedit: 'edit',
    Edit: 'edit',
    edit: 'edit',
    FileWrite: 'write',
    filewrite: 'write',
    Write: 'write',
    write: 'write',
    Read: 'read',
    read: 'read',
    FileRead: 'read',
    fileread: 'read',
    Agent: 'agent',
    agent: 'agent',
};
export const KNOWN_NORMALIZED_TOOL_NAMES = [
    'bash',
    'edit',
    'write',
    'read',
    'agent',
];
const TOOL_NAME_FAMILY_BY_LOWERCASE = Object.fromEntries(Object.entries(TOOL_NAME_ALIASES).map(([alias, family]) => [alias.toLowerCase(), family]));
const MATCHER_TOOL_NAME_BY_FAMILY = {
    bash: 'Bash',
    edit: 'FileEdit',
    write: 'FileEdit',
    read: 'FileEdit',
};
export function getKnownToolNameFamily(toolName) {
    return TOOL_NAME_FAMILY_BY_LOWERCASE[toolName.toLowerCase()];
}
export function getMatcherToolName(toolName) {
    const family = getKnownToolNameFamily(toolName);
    return family ? MATCHER_TOOL_NAME_BY_FAMILY[family] ?? toolName : toolName;
}
export function normalizeToolName(toolName) {
    return getKnownToolNameFamily(toolName) ?? toolName;
}
//# sourceMappingURL=tool-names.js.map