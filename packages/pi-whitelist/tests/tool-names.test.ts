import { describe, it, expect } from 'vitest'
import { normalizeToolName } from '../src/tool-names.js'
import {
  KNOWN_NORMALIZED_TOOL_NAMES,
  TOOL_NAME_ALIASES,
  normalizeToolName as normalizeToolNameFromPublicApi,
} from '../src/index.js'

describe('normalizeToolName', () => {
  it('normalizes Bash and bash consistently', () => {
    expect(normalizeToolName('Bash')).toBe(normalizeToolName('bash'))
    expect(normalizeToolName('bash')).toBe('bash')
  })

  it('normalizes edit aliases to the edit family', () => {
    expect(normalizeToolName('FileEdit')).toBe('edit')
    expect(normalizeToolName('Edit')).toBe('edit')
    expect(normalizeToolName('edit')).toBe('edit')
  })

  it('normalizes write aliases to the write family', () => {
    expect(normalizeToolName('FileWrite')).toBe('write')
    expect(normalizeToolName('Write')).toBe('write')
    expect(normalizeToolName('write')).toBe('write')
  })

  it('normalizes read aliases to the read family', () => {
    expect(normalizeToolName('Read')).toBe('read')
    expect(normalizeToolName('FileRead')).toBe('read')
    expect(normalizeToolName('read')).toBe('read')
  })

  it('normalizes Agent and agent to agent', () => {
    expect(normalizeToolName('Agent')).toBe('agent')
    expect(normalizeToolName('agent')).toBe('agent')
  })

  it('exports normalization helpers from the public API', () => {
    expect(normalizeToolNameFromPublicApi('FileWrite')).toBe('write')
    expect(TOOL_NAME_ALIASES.FileWrite).toBe('write')
    expect(KNOWN_NORMALIZED_TOOL_NAMES).toEqual([
      'bash',
      'edit',
      'write',
      'read',
      'agent',
    ])
  })
})
