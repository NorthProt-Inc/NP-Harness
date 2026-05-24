import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu

function checkForEmojis(filePath: string): { hasEmoji: boolean; matches: string[] } {
  const fullPath = path.resolve(__dirname, '..', filePath)
  if (!fs.existsSync(fullPath)) {
    return { hasEmoji: false, matches: [] }
  }
  const content = fs.readFileSync(fullPath, 'utf8')
  const matches = content.match(EMOJI_REGEX) || []
  return {
    hasEmoji: matches.length > 0,
    matches,
  }
}

describe('no emoji regression', () => {
  const targetFiles = [
    'src/extension.ts',
    'src/dangerous-override.ts',
    'src/circuit-breaker.ts',
    'README.md',
    'SKILL.md',
    'dist/extension.js',
    'dist/dangerous-override.js',
    'dist/circuit-breaker.js',
  ]

  it.each(targetFiles)('should contain no emojis in %s', (filePath) => {
    const result = checkForEmojis(filePath)
    expect(result.hasEmoji, `File ${filePath} contains emojis: ${result.matches.join(', ')}`).toBe(false)
  })
})
