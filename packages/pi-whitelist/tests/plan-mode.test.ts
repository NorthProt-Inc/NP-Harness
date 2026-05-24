import { describe, expect, it } from 'vitest'
import { evaluatePlanMode, isPlanModeBashSafe } from '../src/plan-mode.js'

describe('isPlanModeBashSafe', () => {
  it.each([
    'git status',
    'pwd',
    'ls',
    'find . -maxdepth 2 -type f',
    'rg TODO .',
    'cat package.json',
    'node --version',
    'python --version',
  ])('allows safe read-only command: %s', (command) => {
    expect(isPlanModeBashSafe(command)).toBe(true)
  })

  it.each([
    ['write redirection', 'echo hi > output.txt'],
    ['append redirection', 'echo hi >> output.txt'],
    ['here document', 'cat <<EOF'],
    ['command substitution', 'echo $(whoami)'],
    ['backtick substitution', 'echo `whoami`'],
    ['shell wrapper', 'bash -c ls'],
    ['shell wrapper equivalent', 'sh -lc pwd'],
    ['and chain', 'pwd && ls'],
    ['or chain', 'pwd || ls'],
    ['semicolon chain', 'pwd; ls'],
    ['newline chain', 'pwd\nls'],
    ['background execution', 'sleep 1 &'],
    ['background execution without spaces', 'ls&rm -rf tmp'],
    ['background execution attached to argument', 'cat package.json&rm -rf tmp'],
    ['background execution after command args', 'rg TODO .&rm -rf tmp'],
    ['background execution after find', 'find .&rm -rf tmp'],
    ['pipe', 'cat package.json | head'],
    ['relative executable path', './ls'],
    ['relative nested executable path', './cat package.json'],
    ['absolute executable path', '/tmp/rg TODO .'],
    ['absolute find executable path', '/tmp/find . -maxdepth 1'],
    ['absolute git executable path', '/tmp/git status'],
    ['windows executable path', 'C:\\tmp\\rg TODO .'],
    ['brace-expanded ripgrep preprocessor', 'rg --p{r..r}e=rm TODO .'],
    ['brace-expanded find exec', 'find . -e{x..x}ec rm'],
    ['parameter-expanded ripgrep args', 'rg $RG_ARGS TODO .'],
    ['parameter-expanded find args', 'find . $FIND_ARGS'],
    ['glob-expanded ripgrep args', 'rg * .'],
    ['glob-expanded find args', 'find . *'],
    ['find glob name argument', 'find . -name *'],
    ['npm install', 'npm install'],
    ['pnpm add', 'pnpm add lodash'],
    ['yarn remove', 'yarn remove lodash'],
    ['bun update', 'bun update'],
    ['apt update', 'apt update'],
    ['dnf install', 'dnf install ripgrep'],
    ['brew install', 'brew install ripgrep'],
    ['git commit', 'git commit -m test'],
    ['git push', 'git push'],
    ['git checkout', 'git checkout main'],
    ['git reset', 'git reset --hard'],
    ['git clean', 'git clean -fd'],
    ['git apply', 'git apply patch.diff'],
    ['git rebase', 'git rebase main'],
    ['git merge', 'git merge main'],
    ['git cherry-pick', 'git cherry-pick HEAD'],
    ['git tag', 'git tag v1'],
    ['git branch', 'git branch feature'],
    ['process control', 'kill 123'],
    ['service control', 'systemctl restart ssh'],
    ['privileged command', 'sudo ls'],
    ['network upload/exfiltration', 'curl https://example.com'],
    ['network copy', 'scp file host:/tmp'],
    ['ripgrep preprocessor command', 'rg --pre rm TODO .'],
    ['ripgrep preprocessor assignment', 'rg --pre=/bin/rm TODO .'],
    ['find delete', 'find . -delete'],
    ['find exec flag', 'find . -exec rm {}'],
    ['find execdir flag', 'find . -execdir rm {}'],
    ['find ok flag', 'find . -ok rm {}'],
    ['find fls', 'find . -fls files.txt'],
    ['find fprint', 'find . -fprint files.txt'],
    ['find fprintf', 'find . -fprintf files.txt %p'],
  ])('blocks unsafe %s', (_category, command) => {
    expect(isPlanModeBashSafe(command)).toBe(false)
  })
})

describe('evaluatePlanMode', () => {
  it.each(['Read', 'FileRead', 'read', 'Find', 'find', 'Ls', 'ls'])('allows read-only tool %s', (toolName) => {
    expect(evaluatePlanMode(toolName)).toEqual({ kind: 'allow' })
  })

  it.each(['Edit', 'FileEdit', 'edit', 'Write', 'FileWrite', 'write'])('blocks write-capable tool %s', (toolName) => {
    const outcome = evaluatePlanMode(toolName, 'file.txt')
    expect(outcome.kind).toBe('deny')
  })

  it('allows safe bash commands', () => {
    expect(evaluatePlanMode('Bash', 'git status')).toEqual({ kind: 'allow' })
    expect(evaluatePlanMode('bash', 'pwd')).toEqual({ kind: 'allow' })
  })

  it('blocks unsafe bash commands', () => {
    const outcome = evaluatePlanMode('bash', 'git commit -m test')
    expect(outcome.kind).toBe('deny')
  })

  it.each(['Agent', 'agent'])('blocks delegated execution tool %s', (toolName) => {
    const outcome = evaluatePlanMode(toolName, 'do work')
    expect(outcome.kind).toBe('deny')
  })

  it('blocks unknown custom tools without fallthrough', () => {
    const outcome = evaluatePlanMode('CustomTool', 'payload')
    expect(outcome.kind).toBe('deny')
  })
})
