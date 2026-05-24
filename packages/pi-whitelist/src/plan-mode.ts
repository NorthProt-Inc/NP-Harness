import { isReadOnly } from './readonly.js'
import { getKnownToolNameFamily } from './tool-names.js'

export type PlanModeOutcome =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }

const UNSAFE_FIND_FLAGS = new Set([
  '-delete',
  '-exec',
  '-execdir',
  '-ok',
  '-okdir',
  '-fls',
  '-fprint',
  '-fprint0',
  '-fprintf',
])

const PACKAGE_WRITE_COMMANDS = new Map<string, ReadonlySet<string>>([
  ['npm', new Set(['i', 'install', 'ci', 'update', 'upgrade', 'remove', 'rm', 'uninstall', 'add'])],
  ['pnpm', new Set(['i', 'install', 'update', 'upgrade', 'remove', 'rm', 'uninstall', 'add'])],
  ['yarn', new Set(['install', 'update', 'upgrade', 'remove', 'add'])],
  ['bun', new Set(['install', 'update', 'upgrade', 'remove', 'add'])],
  ['apt', new Set(['install', 'update', 'upgrade', 'remove', 'purge', 'autoremove'])],
  ['apt-get', new Set(['install', 'update', 'upgrade', 'remove', 'purge', 'autoremove'])],
  ['dnf', new Set(['install', 'update', 'upgrade', 'remove', 'erase'])],
  ['yum', new Set(['install', 'update', 'upgrade', 'remove', 'erase'])],
  ['brew', new Set(['install', 'update', 'upgrade', 'remove', 'uninstall'])],
  ['pacman', new Set(['-s', '-sy', '-syu', '-r', '-rs'])],
])

const GIT_WRITE_COMMANDS = new Set([
  'add',
  'am',
  'apply',
  'branch',
  'checkout',
  'cherry-pick',
  'clean',
  'commit',
  'merge',
  'mv',
  'pull',
  'push',
  'rebase',
  'reset',
  'restore',
  'revert',
  'rm',
  'stash',
  'switch',
  'tag',
])

const PROCESS_CONTROL_COMMANDS = new Set([
  'kill',
  'pkill',
  'killall',
  'systemctl',
  'service',
  'shutdown',
  'reboot',
])

const PRIVILEGED_COMMANDS = new Set(['sudo', 'su', 'doas'])
const NETWORK_COMMANDS = new Set(['curl', 'wget', 'nc', 'netcat', 'scp', 'rsync', 'sftp', 'ftp'])
const SHELL_WRAPPERS = new Set(['sh', 'bash', 'zsh', 'fish', 'dash'])

function splitCommand(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean)
}

function containsUnsafeShellSyntax(command: string): boolean {
  return /[<>|&`'";${}*?[\]\\]/.test(command)
    || /\n|\r/.test(command)
    || /&&|\|\|/.test(command)
}

function isEnvironmentAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
}

function isShellWrapper(command: string, args: string[]): boolean {
  return SHELL_WRAPPERS.has(command) && args.some((arg) => /^-[A-Za-z]*c[A-Za-z]*$/.test(arg))
}

function isPackageWrite(command: string, args: string[]): boolean {
  const writeCommands = PACKAGE_WRITE_COMMANDS.get(command)
  return writeCommands ? args.some((arg) => writeCommands.has(arg.toLowerCase())) : false
}

function isGitWrite(args: string[]): boolean {
  const subcommand = args.find((arg) => !arg.startsWith('-'))?.toLowerCase()
  return subcommand ? GIT_WRITE_COMMANDS.has(subcommand) : false
}

function isFindWrite(args: string[]): boolean {
  return args.some((arg) => UNSAFE_FIND_FLAGS.has(arg.toLowerCase()))
}

function isRipgrepUnsafe(args: string[]): boolean {
  return args.some((arg) => arg.toLowerCase() === '--pre' || arg.toLowerCase().startsWith('--pre='))
}

export function isPlanModeBashSafe(command: string): boolean {
  const trimmed = command.trim()
  if (!trimmed || containsUnsafeShellSyntax(trimmed)) return false

  const tokens = splitCommand(trimmed)
  if (tokens.length === 0 || isEnvironmentAssignment(tokens[0])) return false

  if (tokens[0].includes('/') || tokens[0].includes('\\')) return false

  const commandName = tokens[0].toLowerCase()
  const args = tokens.slice(1)

  if (isShellWrapper(commandName, args)) return false
  if (PRIVILEGED_COMMANDS.has(commandName)) return false
  if (PROCESS_CONTROL_COMMANDS.has(commandName)) return false
  if (NETWORK_COMMANDS.has(commandName)) return false
  if (isPackageWrite(commandName, args)) return false

  if (commandName === 'git') {
    if (isGitWrite(args)) return false
    return args[0]?.toLowerCase() === 'status'
  }

  if (commandName === 'find') {
    return !isFindWrite(args)
  }

  if (commandName === 'node' || commandName === 'python' || commandName === 'python3') {
    return args.length === 1 && ['--version', '-v', '-V'].includes(args[0])
  }

  if (commandName === 'rg') {
    return !isRipgrepUnsafe(args)
  }

  return ['pwd', 'ls', 'cat'].includes(commandName)
}

export function evaluatePlanMode(toolName: string, ruleContent?: string): PlanModeOutcome {
  const family = getKnownToolNameFamily(toolName)

  if (family === 'edit' || family === 'write') {
    return { kind: 'deny', reason: `plan mode blocks ${family} tools` }
  }

  if (family === 'agent') {
    return { kind: 'deny', reason: 'plan mode blocks delegated execution' }
  }

  if (family === 'bash') {
    return ruleContent && isPlanModeBashSafe(ruleContent)
      ? { kind: 'allow' }
      : { kind: 'deny', reason: 'plan mode blocks unsafe bash command' }
  }

  if (isReadOnly(toolName)) {
    return { kind: 'allow' }
  }

  return { kind: 'deny', reason: `plan mode blocks unknown tool ${toolName}` }
}
