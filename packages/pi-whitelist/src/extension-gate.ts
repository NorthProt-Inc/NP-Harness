import type { PermissionAskDecision, PermissionDecision, PermissionRuleValue } from './types/index.js'
import { PermissionManager } from './manager.js'
import { checkDangerousOverride } from './dangerous-override.js'
import { evaluatePlanMode } from './plan-mode.js'
import { shouldTripCriticalCircuitBreaker } from './circuit-breaker.js'
import { getKnownToolNameFamily } from './tool-names.js'

export interface ToolCallEventLike {
  toolName: string
  input?: Record<string, unknown>
}

export interface ToolCallGateOptions {
  hasUI?: boolean
}

export type ToolCallBlock = {
  block: true
  reason: string
}

export type ToolCallGateAction =
  | { kind: 'allow'; toolName: string; ruleContent: string | undefined }
  | { kind: 'block'; toolName: string; ruleContent: string | undefined; reason: string }
  | { kind: 'dangerous-prompt'; toolName: string; ruleContent: string | undefined; decision: PermissionAskDecision }
  | { kind: 'permission-prompt'; toolName: string; ruleContent: string | undefined; decision: PermissionDecision }

export function extractRuleContent(toolName: string, input: Record<string, unknown> = {}): string | undefined {
  const family = getKnownToolNameFamily(toolName)

  if (family === 'bash') {
    return (input.command as string) ?? undefined
  }

  if (family === 'edit' || family === 'write' || family === 'read') {
    return (input.path as string) ?? (input.file_path as string) ?? undefined
  }

  return undefined
}

function block(toolName: string, ruleContent: string | undefined, reason: string): ToolCallGateAction {
  return { kind: 'block', toolName, ruleContent, reason }
}

function actionFromDangerous(toolName: string, ruleContent: string | undefined, decision: PermissionAskDecision | { behavior: 'deny'; message?: string }, hasUI: boolean): ToolCallGateAction {
  if (decision.behavior === 'deny') {
    return block(toolName, ruleContent, decision.message ?? `Dangerous command denied: ${toolName}`)
  }

  if (!hasUI) {
    return block(toolName, ruleContent, decision.message ?? `Dangerous command: ${toolName}`)
  }

  return { kind: 'dangerous-prompt', toolName, ruleContent, decision }
}

function actionFromDecision(toolName: string, ruleContent: string | undefined, decision: PermissionDecision, hasUI: boolean): ToolCallGateAction {
  if (decision.behavior === 'allow') {
    return { kind: 'allow', toolName, ruleContent }
  }

  if (decision.behavior === 'deny') {
    return block(toolName, ruleContent, decision.message ?? `Denied by whitelist: ${toolName}`)
  }

  if (!hasUI) {
    return block(
      toolName,
      ruleContent,
      `Whitelist gate: no UI to confirm ${toolName}${ruleContent ? ` (${ruleContent})` : ''}`,
    )
  }

  return { kind: 'permission-prompt', toolName, ruleContent, decision }
}

export function hasExplicitDeny(manager: PermissionManager, input: PermissionRuleValue): boolean {
  return manager.hasMatchingRule(input, 'deny')
}

export function evaluateToolCallGate(
  event: ToolCallEventLike,
  manager: PermissionManager,
  options: ToolCallGateOptions = {},
): ToolCallGateAction {
  const toolName = event.toolName
  const ruleContent = extractRuleContent(toolName, event.input)
  const hasUI = options.hasUI ?? true
  const input = { toolName, ruleContent }
  const mode = manager.getMode()

  if (mode === 'bypassPermissions') {
    if (shouldTripCriticalCircuitBreaker(toolName, ruleContent)) {
      return block(
        toolName,
        ruleContent,
        `Critical circuit breaker blocked ${toolName}${ruleContent ? ` (${ruleContent})` : ''}`,
      )
    }

    return { kind: 'allow', toolName, ruleContent }
  }

  if (hasExplicitDeny(manager, input)) {
    const decision = manager.check(input)
    const reason = decision.behavior === 'deny'
      ? decision.message ?? `Denied by whitelist: ${toolName}`
      : `Permission denied for ${toolName}: ${ruleContent ?? 'any'}`
    return block(toolName, ruleContent, reason)
  }

  if (mode === 'plan') {
    const planOutcome = evaluatePlanMode(toolName, ruleContent)
    if (planOutcome.kind === 'deny') {
      return block(toolName, ruleContent, planOutcome.reason)
    }

    const dangerousOverride = checkDangerousOverride(toolName, ruleContent)
    if (dangerousOverride) {
      return actionFromDangerous(toolName, ruleContent, dangerousOverride, hasUI)
    }

    return { kind: 'allow', toolName, ruleContent }
  }

  const dangerousOverride = checkDangerousOverride(toolName, ruleContent)
  if (dangerousOverride) {
    return actionFromDangerous(toolName, ruleContent, dangerousOverride, hasUI)
  }

  return actionFromDecision(toolName, ruleContent, manager.check(input), hasUI)
}
