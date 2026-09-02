// Reads the commits since the last v* tag and prints the version the next
// release should carry. Called by the tag job in deploy.yml, which used to bump
// the patch number unconditionally — the commit types decide it now.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { parseHeader } from './commit-message.mjs'

const VERSION = /^v(\d+)\.(\d+)\.(\d+)/
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m
// git log writes messages back to back, so they need a separator no message can
// contain: RS, which git emits for %x1e and no editor will type.
const SEPARATOR = '\x1e'

export function bumpFrom(messages) {
  let bump = 'patch'
  for (const message of messages) {
    if (BREAKING_FOOTER.test(message)) return 'major'
    const parsed = parseHeader(message.split('\n', 1)[0].trim())
    if (!parsed) continue
    if (parsed.breaking) return 'major'
    if (parsed.type === 'feat') bump = 'minor'
  }
  return bump
}

// An empty tag means no release yet, so the count starts from nothing and the
// first bump lands on v0.0.1, v0.1.0 or v1.0.0 depending on what is in the log.
export function nextVersion(latestTag, messages) {
  const parts = latestTag === '' ? ['', '0', '0', '0'] : VERSION.exec(latestTag)
  if (!parts) throw new Error(`cannot read a version out of the tag \`${latestTag}\``)
  const [major, minor, patch] = parts.slice(1, 4).map(Number)
  switch (bumpFrom(messages)) {
    case 'major':
      return `v${major + 1}.0.0`
    case 'minor':
      return `v${major}.${minor + 1}.0`
    default:
      return `v${major}.${minor}.${patch + 1}`
  }
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // The glob keeps prerelease and other non-v1.2.3 tags out of the running, so
  // whatever comes back parses.
  const latestTag = git('tag', '-l', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=-v:refname').split('\n')[0] ?? ''
  const log = git('log', ...(latestTag === '' ? [] : [`${latestTag}..HEAD`]), `--format=%B${SEPARATOR}`)
  const messages = log.split(SEPARATOR).map((m) => m.trim()).filter(Boolean)
  process.stdout.write(`${nextVersion(latestTag, messages)}\n`)
}
