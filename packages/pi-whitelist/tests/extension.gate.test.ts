import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { PermissionManager } from '../src/manager.js'
import { shouldTripCriticalCircuitBreaker } from '../src/circuit-breaker.js'
import { evaluateToolCallGate } from '../src/extension-gate.js'

function bashEvent(command: string) {
  return { toolName: 'bash', input: { command } }
}

function pathEvent(toolName: string, path: string) {
  return { toolName, input: { path } }
}

describe('extension tool_call gate precedence', () => {
  it('explicit deny wins before dangerous override in default mode', () => {
    const manager = new PermissionManager()
    manager.addRule({ toolName: 'Bash', ruleContent: 'rm -rf *' }, 'deny', 'session')

    const action = evaluateToolCallGate(bashEvent('rm -rf /tmp/project'), manager)

    expect(action.kind).toBe('block')
    if (action.kind === 'block') {
      expect(action.reason).toContain('Permission denied')
      expect(action.reason).not.toContain('Dangerous')
    }
  })

  it('explicit deny wins before dangerous override in auto mode', () => {
    const manager = new PermissionManager({ mode: 'auto' })
    manager.addRule({ toolName: 'Bash', ruleContent: 'rm -rf *' }, 'deny', 'session')

    const action = evaluateToolCallGate(bashEvent('rm -rf /tmp/project'), manager)

    expect(action.kind).toBe('block')
    if (action.kind === 'block') {
      expect(action.reason).toContain('Permission denied')
      expect(action.reason).not.toContain('Dangerous')
    }
  })

  it('explicit deny wins before dangerous override in plan mode', () => {
    const manager = new PermissionManager({ mode: 'plan' })
    manager.addRule({ toolName: 'Bash', ruleContent: 'rm -rf *' }, 'deny', 'session')

    const action = evaluateToolCallGate(bashEvent('rm -rf /tmp/project'), manager)

    expect(action.kind).toBe('block')
    if (action.kind === 'block') {
      expect(action.reason).toContain('Permission denied')
      expect(action.reason).not.toContain('plan mode blocks')
      expect(action.reason).not.toContain('Dangerous')
    }
  })

  it('auto allows unknown non-dangerous tool calls', () => {
    const manager = new PermissionManager({ mode: 'auto' })

    const action = evaluateToolCallGate({ toolName: 'customTool', input: { value: 1 } }, manager)

    expect(action.kind).toBe('allow')
  })

  it('plan blocks unknown custom tool calls', () => {
    const manager = new PermissionManager({ mode: 'plan' })

    const action = evaluateToolCallGate({ toolName: 'customTool', input: { value: 1 } }, manager)

    expect(action.kind).toBe('block')
    if (action.kind === 'block') {
      expect(action.reason).toContain('unknown tool customTool')
    }
  })

  it('plan blocks Agent and delegated execution tool calls', () => {
    const manager = new PermissionManager({ mode: 'plan' })

    const action = evaluateToolCallGate({ toolName: 'Agent', input: {} }, manager)

    expect(action.kind).toBe('block')
    if (action.kind === 'block') {
      expect(action.reason).toContain('delegated execution')
    }
  })

  it('plan allows known read-only tool calls', () => {
    const manager = new PermissionManager({ mode: 'plan' })

    const action = evaluateToolCallGate(pathEvent('read', '/tmp/report.md'), manager)

    expect(action.kind).toBe('allow')
  })

  it('plan allows safe bash and blocks unsafe bash without prompting', () => {
    const manager = new PermissionManager({ mode: 'plan' })

    expect(evaluateToolCallGate(bashEvent('ls -la'), manager).kind).toBe('allow')

    const unsafe = evaluateToolCallGate(bashEvent('npm install left-pad'), manager)
    expect(unsafe.kind).toBe('block')
    if (unsafe.kind === 'block') {
      expect(unsafe.reason).toContain('unsafe bash')
    }
  })

  it('dangerous override still prompts in default and auto modes', () => {
    const defaultManager = new PermissionManager()
    const autoManager = new PermissionManager({ mode: 'auto' })

    expect(evaluateToolCallGate(bashEvent('rm -rf /tmp/project'), defaultManager).kind).toBe('dangerous-prompt')
    expect(evaluateToolCallGate(bashEvent('rm -rf /tmp/project'), autoManager).kind).toBe('dangerous-prompt')
  })

  it('bypass allows ordinary calls', () => {
    const manager = new PermissionManager({ mode: 'bypassPermissions' })

    const action = evaluateToolCallGate(bashEvent('npm install left-pad'), manager)

    expect(action.kind).toBe('allow')
  })

  it('bypass skips normal explicit deny rules by design', () => {
    const manager = new PermissionManager({ mode: 'bypassPermissions' })
    manager.addRule({ toolName: 'Bash', ruleContent: 'npm *' }, 'deny', 'session')

    const action = evaluateToolCallGate(bashEvent('npm install left-pad'), manager)

    expect(action.kind).toBe('allow')
  })

  it('bypass critical circuit breaker blocks root and home destructive calls (compound/wrapper)', () => {
    const manager = new PermissionManager({ mode: 'bypassPermissions' })

    const rootAction = evaluateToolCallGate(bashEvent('rm -rf /'), manager)
    const homeAction = evaluateToolCallGate(bashEvent(`rm -rf ${homedir()}`), manager)
    const compoundAction = evaluateToolCallGate(bashEvent('git status; rm -rf /'), manager)
    const wrapperAction = evaluateToolCallGate(bashEvent(`bash -c 'rm -rf ${homedir()}'`), manager)

    expect(rootAction.kind).toBe('block')
    expect(homeAction.kind).toBe('block')
    expect(compoundAction.kind).toBe('block')
    expect(wrapperAction.kind).toBe('block')
  })

  it('critical circuit breaker detects direct writes to critical system paths', () => {
    expect(shouldTripCriticalCircuitBreaker('write', '/etc/passwd')).toBe(true)
    expect(shouldTripCriticalCircuitBreaker('FileWrite', '/usr/local/bin/tool')).toBe(true)
    expect(shouldTripCriticalCircuitBreaker('write', '/tmp/file.txt')).toBe(false)
  })

  it('no-UI mode blocks prompts safely instead of crashing', () => {
    const manager = new PermissionManager()

    const dangerous = evaluateToolCallGate(bashEvent('rm -rf /tmp/project'), manager, { hasUI: false })
    const ordinaryPrompt = evaluateToolCallGate(bashEvent('echo hello'), manager, { hasUI: false })

    expect(dangerous.kind).toBe('block')
    expect(ordinaryPrompt.kind).toBe('block')
  })
})
