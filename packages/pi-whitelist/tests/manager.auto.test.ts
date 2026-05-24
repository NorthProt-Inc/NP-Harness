import { describe, expect, it } from 'vitest'
import { PermissionManager } from '../src/manager.js'

describe('PermissionManager auto mode', () => {
  it('allows with an auto mode reason when no rule matches', () => {
    const manager = new PermissionManager({ mode: 'auto' })

    const decision = manager.check({ toolName: 'Bash', ruleContent: 'npm test' })

    expect(decision.behavior).toBe('allow')
    expect(decision.decisionReason).toEqual({ type: 'mode', mode: 'auto' })
  })

  it('denies when a deny rule matches', () => {
    const manager = new PermissionManager({ mode: 'auto' })
    manager.addRule({ toolName: 'Bash', ruleContent: 'danger *' }, 'deny', 'session')

    const decision = manager.check({ toolName: 'Bash', ruleContent: 'danger now' })

    expect(decision.behavior).toBe('deny')
    expect(decision.decisionReason?.type).toBe('rule')
  })

  it('allows when an ask rule matches', () => {
    const manager = new PermissionManager({ mode: 'auto' })
    manager.addRule({ toolName: 'Bash', ruleContent: 'npm *' }, 'ask', 'session')

    const decision = manager.check({ toolName: 'Bash', ruleContent: 'npm test' })

    expect(decision.behavior).toBe('allow')
    expect(decision.decisionReason).toEqual({ type: 'mode', mode: 'auto' })
  })

  it('allows when an allow rule matches', () => {
    const manager = new PermissionManager({ mode: 'auto' })
    manager.addRule({ toolName: 'Bash', ruleContent: 'git *' }, 'allow', 'session')

    const decision = manager.check({ toolName: 'Bash', ruleContent: 'git status' })

    expect(decision.behavior).toBe('allow')
    expect(decision.decisionReason).toEqual({ type: 'mode', mode: 'auto' })
  })
})
