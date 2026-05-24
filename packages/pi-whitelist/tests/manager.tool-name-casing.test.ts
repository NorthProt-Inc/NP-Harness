import { describe, expect, it } from 'vitest'
import { PermissionManager } from '../src/manager.js'

function expectDeniedByRule(manager: PermissionManager, toolName: string, ruleContent: string): void {
  const decision = manager.check({ toolName, ruleContent })
  expect(decision.behavior).toBe('deny')
  expect(decision.decisionReason?.type).toBe('rule')
}

describe('PermissionManager built-in tool-name casing and aliases', () => {
  it('matches lowercase bash invocations against saved PascalCase Bash rules using command matching', () => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: 'Bash', ruleContent: 'npm test' }, 'deny', 'session')

    expectDeniedByRule(manager, 'bash', 'npm test -- --run')
  })

  it('matches lowercase edit invocations against saved FileEdit rules using file matching', () => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: 'FileEdit', ruleContent: '/repo/**' }, 'deny', 'session')

    expectDeniedByRule(manager, 'edit', 'C:\\repo\\src.ts')
  })

  it('matches lowercase edit invocations against saved Edit alias rules using file matching', () => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: 'Edit', ruleContent: '/repo/**' }, 'deny', 'session')

    expectDeniedByRule(manager, 'edit', 'C:\\repo\\src.ts')
  })

  it.each([
    ['Read', 'read'],
    ['FileRead', 'fileread'],
    ['Edit', 'edit'],
    ['FileEdit', 'fileedit'],
    ['Write', 'write'],
    ['FileWrite', 'filewrite'],
  ])('uses file/glob matching for %s rules and %s invocations', (ruleToolName, inputToolName) => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: ruleToolName, ruleContent: '/workspace/**' }, 'deny', 'session')

    expectDeniedByRule(manager, inputToolName, 'C:\\workspace\\src\\index.ts')
  })

  it('preserves exact matching for unknown custom tools', () => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: 'CustomTool', ruleContent: 'payload' }, 'deny', 'session')

    expect(manager.check({ toolName: 'customtool', ruleContent: 'payload' }).behavior).toBe('ask')
    expectDeniedByRule(manager, 'CustomTool', 'payload')
  })

  it('returns built-in alias rules from getRulesForTool', () => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: 'Bash', ruleContent: 'npm test' }, 'deny', 'session')
    manager.addRule({ toolName: 'FileEdit', ruleContent: '/repo/**' }, 'allow', 'session')
    manager.addRule({ toolName: 'Edit', ruleContent: '/other/**' }, 'ask', 'session')

    expect(manager.getRulesForTool('bash').map((rule) => rule.ruleValue.toolName)).toEqual(['Bash'])
    expect(manager.getRulesForTool('edit').map((rule) => rule.ruleValue.toolName)).toEqual([
      'FileEdit',
      'Edit',
    ])
  })

  it('keeps getRulesForTool exact for unknown custom tools', () => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: 'CustomTool', ruleContent: 'payload' }, 'deny', 'session')

    expect(manager.getRulesForTool('customtool')).toEqual([])
    expect(manager.getRulesForTool('CustomTool')).toHaveLength(1)
  })
})
