import { describe, expect, it } from 'vitest'
import { MAX_HEADER, checkCommitMessage, messageLines, parseHeader } from '../../scripts/commit-message.mjs'
import { bumpFrom, nextVersion } from '../../scripts/next-version.mjs'

const errorsFor = (message: string): string[] => checkCommitMessage(message).errors

describe('parseHeader', () => {
  it('reads the type, scope, breaking marker and description', () => {
    expect(parseHeader('feat(audio): add a phaser')).toMatchObject({
      type: 'feat',
      scope: 'audio',
      breaking: false,
      description: 'add a phaser',
    })
    expect(parseHeader('refactor!: drop the v3 settings migration')).toMatchObject({
      type: 'refactor',
      scope: undefined,
      breaking: true,
    })
  })

  it('returns null for anything that is not a header', () => {
    expect(parseHeader('Merge pull request #3 from yusif-projects/visual-redesign')).toBeNull()
    expect(parseHeader('feat:no space after the colon')).toBeNull()
    expect(parseHeader('add the fader')).toBeNull()
  })
})

describe('checkCommitMessage', () => {
  it('accepts the shapes the spec allows', () => {
    expect(errorsFor('fix: hold the count through a dip')).toEqual([])
    expect(errorsFor('feat(vision): count a thumb by abduction')).toEqual([])
    expect(errorsFor('feat(state)!: store the rack as a list')).toEqual([])
    expect(errorsFor('docs: split the README into docs/\n\nOne page per subsystem.')).toEqual([])
  })

  it('rejects an unknown type and a malformed header', () => {
    expect(errorsFor('feet: add a phaser').join()).toContain('`feet` is not one of the types')
    expect(errorsFor('add a phaser').join()).toContain('type(optional scope): description')
  })

  it('rejects sentence case and a trailing period, but not an acronym', () => {
    expect(errorsFor('fix: Hold the count').join()).toContain('starts lowercase')
    expect(errorsFor('fix: hold the count.').join()).toContain('trailing period')
    expect(errorsFor('fix: HUD counts drift on a stale frame')).toEqual([])
  })

  it('rejects a header past the length limit', () => {
    const long = `fix: ${'a'.repeat(MAX_HEADER)}`
    expect(errorsFor(long).join()).toContain(`${long.length} characters`)
  })

  it('needs a blank line before a body', () => {
    expect(errorsFor('fix: hold the count\nbecause it dips').join()).toContain('blank line')
  })

  it('holds a breaking-change footer to its exact spelling', () => {
    expect(errorsFor('feat: store the rack as a list\n\nBREAKING CHANGE: v4 blobs are dropped')).toEqual([])
    expect(errorsFor('feat: store the rack as a list\n\nBreaking change: v4 blobs are dropped').join()).toContain(
      'BREAKING CHANGE:',
    )
  })

  it('rejects tool attribution but not a human co-author', () => {
    for (const trailer of [
      'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>',
      'Co-authored-by: Claude <noreply@anthropic.com>',
      'Claude-Session: https://claude.ai/code/abc',
      '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
    ]) {
      expect(errorsFor(`fix: hold the count\n\n${trailer}`).join()).toContain('does not attribute commits to a tool')
    }
    expect(errorsFor('fix: hold the count\n\nCo-authored-by: Jane Doe <jane@example.com>')).toEqual([])
  })

  // Rewriting these would mean editing a message git is about to replace.
  it('waves through what git generates', () => {
    for (const header of [
      'Merge pull request #3 from yusif-projects/visual-redesign',
      'Revert "feat: add a phaser"',
      'fixup! feat: add a phaser',
    ]) {
      expect(checkCommitMessage(header)).toMatchObject({ generated: true, errors: [] })
    }
  })

  it('reports an empty message rather than passing it', () => {
    expect(errorsFor('\n\n# Please enter a commit message.').length).toBe(1)
  })
})

describe('messageLines', () => {
  it('drops the comment block and everything under the scissors', () => {
    const raw = [
      'fix: hold the count',
      '# Please enter a commit message.',
      '',
      'Body line.',
      '# ------------------------ >8 ------------------------',
      'diff --git a/src/App.tsx b/src/App.tsx',
    ].join('\n')
    expect(messageLines(raw)).toEqual(['fix: hold the count', '', 'Body line.'])
  })
})

describe('bumpFrom', () => {
  it('takes the largest bump any commit asks for', () => {
    expect(bumpFrom(['chore: bump vite', 'docs: fix a link'])).toBe('patch')
    expect(bumpFrom(['chore: bump vite', 'feat(audio): add a phaser'])).toBe('minor')
    expect(bumpFrom(['feat(audio): add a phaser', 'refactor!: drop the v3 migration'])).toBe('major')
  })

  it('reads a breaking change out of the footer as well as the header', () => {
    expect(bumpFrom(['fix: hold the count\n\nBREAKING CHANGE: the v3 blob is dropped'])).toBe('major')
    expect(bumpFrom(['fix: hold the count\n\nMentions a BREAKING CHANGE: mid-sentence'])).toBe('patch')
  })

  it('ignores a message that carries no type', () => {
    expect(bumpFrom(['Merge pull request #3 from yusif-projects/visual-redesign'])).toBe('patch')
  })
})

describe('nextVersion', () => {
  it('moves the number the commits ask for and zeroes the ones below it', () => {
    expect(nextVersion('v1.2.3', ['fix: hold the count'])).toBe('v1.2.4')
    expect(nextVersion('v1.2.3', ['feat: add a phaser'])).toBe('v1.3.0')
    expect(nextVersion('v1.2.3', ['feat!: store the rack as a list'])).toBe('v2.0.0')
  })

  it('starts from nothing when no release has been tagged', () => {
    expect(nextVersion('', ['fix: hold the count'])).toBe('v0.0.1')
    expect(nextVersion('', ['feat: add a phaser'])).toBe('v0.1.0')
  })

  it('throws rather than tagging off a version it cannot read', () => {
    expect(() => nextVersion('release-7', ['fix: hold the count'])).toThrow()
  })
})
