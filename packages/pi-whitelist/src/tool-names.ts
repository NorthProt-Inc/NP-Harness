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
} as const

export const KNOWN_NORMALIZED_TOOL_NAMES = [
  'bash',
  'edit',
  'write',
  'read',
  'agent',
] as const

export type ToolNameAlias = keyof typeof TOOL_NAME_ALIASES
export type KnownNormalizedToolName = (typeof KNOWN_NORMALIZED_TOOL_NAMES)[number]
export type NormalizedToolName = KnownNormalizedToolName | (string & {})

const TOOL_NAME_FAMILY_BY_LOWERCASE = Object.fromEntries(
  Object.entries(TOOL_NAME_ALIASES).map(([alias, family]) => [alias.toLowerCase(), family])
) as Record<string, KnownNormalizedToolName | undefined>

const MATCHER_TOOL_NAME_BY_FAMILY: Partial<Record<KnownNormalizedToolName, string>> = {
  bash: 'Bash',
  edit: 'FileEdit',
  write: 'FileEdit',
  read: 'FileEdit',
}

export function getKnownToolNameFamily(toolName: string): KnownNormalizedToolName | undefined {
  return TOOL_NAME_FAMILY_BY_LOWERCASE[toolName.toLowerCase()]
}

export function getMatcherToolName(toolName: string): string {
  const family = getKnownToolNameFamily(toolName)
  return family ? MATCHER_TOOL_NAME_BY_FAMILY[family] ?? toolName : toolName
}

export function normalizeToolName(toolName: string): NormalizedToolName {
  return getKnownToolNameFamily(toolName) ?? toolName
}
