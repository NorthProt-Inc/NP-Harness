import { describe, it, expect } from 'vitest'
import {
  EXTERNAL_PERMISSION_MODES,
  MODE_CYCLE,
  PERMISSION_MODE_ALIASES,
  permissionModeSchema,
  permissionSettingsSchema,
} from '../src/types/index.js'

describe('permission mode schemas', () => {
  it('accepts auto mode directly', () => {
    expect(permissionModeSchema.parse('auto')).toBe('auto')
  })

  it('accepts auto as settings defaultMode', () => {
    const parsed = permissionSettingsSchema.parse({
      permissions: { defaultMode: 'auto' },
    })

    expect(parsed.permissions.defaultMode).toBe('auto')
  })

  it('accepts every external permission mode', () => {
    for (const mode of EXTERNAL_PERMISSION_MODES) {
      expect(permissionModeSchema.parse(mode)).toBe(mode)
    }
  })

  it('exports the permission mode cycle in UI order', () => {
    expect(MODE_CYCLE).toEqual([
      'default',
      'auto',
      'plan',
      'bypassPermissions',
    ])
  })

  it('exports permission mode aliases', () => {
    expect(PERMISSION_MODE_ALIASES).toMatchObject({
      default: 'default',
      auto: 'auto',
      plan: 'plan',
      bypass: 'bypassPermissions',
      bypassPermissions: 'bypassPermissions',
      acceptEdits: 'acceptEdits',
      dontAsk: 'dontAsk',
    })
  })

  it('rejects invalid modes', () => {
    expect(() => permissionModeSchema.parse('invalid')).toThrow()
    expect(() => permissionSettingsSchema.parse({
      permissions: { defaultMode: 'invalid' },
    })).toThrow()
  })
})
