// Validates a commit message against Conventional Commits. Runs from the
// commit-msg hook on every local commit and over a range in CI, so both paths
// share one grammar — the header regex here is the only definition of it.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const TYPES = [
  'feat', // a user-visible capability
  'fix', // a user-visible bug fix
  'perf', // faster or lighter, same behaviour
  'refactor', // same behaviour, different code
  'docs', // docs/, README, AGENTS.md, comments
  'test', // tests only
  'build', // vite, tsconfig, scripts/, dependencies
  'ci', // .github/workflows
  'style', // formatting only, no code change
  'chore', // anything else that ships no behaviour
  'revert', // undoes an earlier commit
]

export const MAX_HEADER = 72

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^()]*)\))?(?<breaking>!)?: (?<description>.*)$/
const SCOPE = /^[a-z0-9][a-z0-9./,-]*$/
// Git writes these itself, or rewrites them on the next rebase. Holding them to
// the format would mean editing a message the tool is about to replace.
const GENERATED = /^(?:Merge |Revert "|fixup!|squash!|amend!)/
const BREAKING_FOOTER = /^breaking[ -]change/i
// Commits here are authored by a person. A tool that helped write the change is
// not a contributor, and GitHub renders a co-author trailer as one on every
// commit page. The setting in .claude/settings.json turns the trailer off at the
// source; this is the gate for a session that never read it.
const ATTRIBUTION = [
  /^co-authored-by:.*(claude|anthropic)/i,
  /^claude-session:/i,
  /generated with \[?claude code/i,
  /^\s*🤖/,
]

// Everything git adds to the editor buffer: the comment block, and anything
// below the --verbose scissors line, which is a diff, not a message.
export function messageLines(raw) {
  const lines = []
  for (const line of raw.split('\n')) {
    const text = line.replace(/\r$/, '')
    if (/^# -{1,} >8 -{1,}$/.test(text)) break
    if (text.startsWith('#')) continue
    lines.push(text)
  }
  while (lines.length > 0 && lines.at(-1).trim() === '') lines.pop()
  return lines
}

// Returns null for anything that is not a conventional header — callers treat
// that as "no type", never as an error on its own.
export function parseHeader(header) {
  const match = HEADER.exec(header)
  if (!match) return null
  const { type, scope, breaking, description } = match.groups
  return { type, scope, breaking: breaking === '!', description }
}

export function checkCommitMessage(raw) {
  const lines = messageLines(raw)
  const header = lines[0] ?? ''
  const errors = []

  if (header.trim() === '') return { header, generated: false, errors: ['the message is empty'] }
  if (GENERATED.test(header)) return { header, generated: true, errors: [] }

  const parsed = parseHeader(header)
  if (!parsed) {
    errors.push('the header must read `type(optional scope): description` — mind the colon and the space')
  } else {
    const { type, scope, description } = parsed
    if (!TYPES.includes(type)) errors.push(`\`${type}\` is not one of the types below`)
    if (scope !== undefined && !SCOPE.test(scope)) {
      errors.push(`the scope \`${scope}\` must be lowercase, e.g. \`audio\`, \`vision\`, \`deps\``)
    }
    if (description.trim() === '') errors.push('the description is empty')
    if (/^[A-Z][a-z]/.test(description)) {
      errors.push('the description starts lowercase — `add the fader`, not `Add the fader` (HUD, DJ and other acronyms are fine)')
    }
    if (description.endsWith('.')) errors.push('the description takes no trailing period')
  }

  if (header.length > MAX_HEADER) {
    errors.push(`the header is ${header.length} characters — keep it to ${MAX_HEADER}`)
  }
  if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push('a body or footer needs one blank line after the header')
  }
  for (const line of lines.slice(1)) {
    if (BREAKING_FOOTER.test(line) && !/^BREAKING[ -]CHANGE: ./.test(line)) {
      errors.push('a breaking change is footed `BREAKING CHANGE: <what broke>`, capitalised, at the start of its own line')
    }
    if (ATTRIBUTION.some((pattern) => pattern.test(line))) {
      errors.push(`this repo does not attribute commits to a tool — drop the line \`${line.trim()}\``)
    }
  }

  return { header, generated: false, errors }
}

function report({ header, errors }) {
  console.error(`\nNot a conventional commit:\n\n    ${header}\n`)
  for (const error of errors) console.error(`  · ${error}`)
  console.error(`
  Format   type(optional scope)!: description
  Types    ${TYPES.join(', ')}
  Example  fix(vision): hold the count through a dip below the threshold

  A \`!\` before the colon, or a \`BREAKING CHANGE:\` footer, bumps the major
  version on the next deploy. \`feat\` bumps the minor, everything else the patch.
`)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })

function main(argv) {
  const messages =
    argv[0] === '--range'
      ? git('rev-list', '--no-merges', argv[1])
          .split('\n')
          .filter(Boolean)
          .map((sha) => git('show', '-s', '--format=%B', sha))
      : [readFileSync(argv[0], 'utf8')]

  let failed = false
  for (const message of messages) {
    const result = checkCommitMessage(message)
    if (result.errors.length > 0) {
      report(result)
      failed = true
    }
  }
  return failed ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('usage: commit-message.mjs <file> | --range <base>..<head>')
    process.exit(2)
  }
  process.exit(main(args))
}
