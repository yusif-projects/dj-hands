# AI

This project is built with [Claude Code](https://claude.com/claude-code). Four
skills are committed under `.claude/skills/` — two I wrote for this repo, two
vendored from upstream. A skill is a folder with a `SKILL.md` that teaches the
agent one job: how to commit here, how to keep the docs true, how to draw the
architecture, how to hold the design system.

None of it ships to users. It is build-time tooling, and it is committed rather
than installed per machine so a clone gets the same versions.

## Contents

- [How an agent starts here](#how-an-agent-starts-here)
- [My skills](#my-skills)
  - [ship](#ship) — stage, commit, push, without breaking production
  - [update-docs](#update-docs) — keep `docs/` true after a code change
- [Vendored skills](#vendored-skills)
  - [archify](#archify) — the architecture diagram, generated and verified
  - [impeccable](#impeccable) — the design system and the console look
- [Vendoring a skill](#vendoring-a-skill)
- [Keeping vendored skills current](#keeping-vendored-skills-current)

## How an agent starts here

[AGENTS.md](../AGENTS.md) is the entry point — a routing table from "the task
touches X" to the doc that owns X. Two root files carry context the code cannot
tell you:

| File | What it holds |
| --- | --- |
| [PRODUCT.md](../PRODUCT.md) | Audiences, purpose, positioning, durable constraints, brand commitments |
| [DESIGN.md](../DESIGN.md) | Colour, typography, layout, depth and component rules for the console UI |

Both sit at the root because Impeccable looks for them there.

```
.claude/
├── agents/           four subagents that ship with Impeccable
└── skills/
    ├── ship/         mine
    ├── update-docs/  mine
    ├── archify/      vendored — tt-a1i/archify, MIT
    └── impeccable/   vendored — v4.1.3, Apache 2.0
```

A skill is matched by its frontmatter `description`, not by name — you describe
the task and the right one loads.

## My skills

Both are plain markdown. No scripts, no dependencies.

### ship

Stages everything, writes a commit message in this repo's style, and pushes to
the current branch.

**Main things it does**

- Reads the diff before writing the message, and scans staged files for secrets,
  `.env*`, or unrelated work in progress
- Writes a [Conventional Commit](https://www.conventionalcommits.org) —
  `type(scope): description`, imperative and lowercase, under 72 characters, no
  trailing period, describing the user-visible change — and picks the type
  carefully, since it decides the version the deploy tags
- Refuses to resolve a rejected push on its own — no silent pull, rebase or merge
- Adds no attribution trailer — `.claude/settings.json` disables it at the
  source, and the `commit-msg` hook rejects one that slips through anyway. A
  skill's instructions can be outranked by the session's own; a hook cannot

```
ship it
```

**Why this repo needs it.** A push to `main` is a production deploy: it triggers
[deploy.yml](../.github/workflows/deploy.yml), which publishes to
[www.dj-hands.com](https://www.dj-hands.com) and tags the release. There is no
staging environment. So `ship` runs `npm run lint`, `npm test` and `npm run build`
locally and asks for confirmation before pushing to `main`, while pushing freely
on any other branch. It also encodes the conventions I would otherwise have to
repeat every time — including no co-author trailers.

### update-docs

Brings `docs/` and the root README back in line with the code after a change.

**Main things it does**

- Routes a change to the page that owns it — `src/audio/*` to
  [AUDIO.md](AUDIO.md), `src/state/settings.ts` to
  [CONFIGURATION.md](CONFIGURATION.md), and so on
- Edits the existing paragraph or table row instead of appending a "New in this
  version" section — these docs describe current state, not history
- Registers any genuinely new page in *both* indexes, and verifies every link
  and code reference it touched

```
update the docs
```

**Why this repo needs it.** There are 11 docs plus the README, and AGENTS.md
tells every agent to read the doc *before* grepping the source — so a stale page
does not just sit there, it actively misleads. The docs also quote real defaults,
real ranges and real function names, which is exactly the kind of detail that
drifts silently. The pages that come apart most often are the defaults table in
CONFIGURATION.md and the settings prose in USER-GUIDE.md; the skill knows to
check that pair together.

## Vendored skills

These carry real code, so they are committed rather than installed per machine.

### archify

Renders the architecture diagram in [DIAGRAMS/](DIAGRAMS/) from a typed JSON
spec into one standalone HTML file.

**Main things it does**

- Five diagram types — `architecture`, `workflow`, `sequence`, `dataflow`,
  `lifecycle`
- `validate` before `deliver`, so a broken spec fails loudly instead of
  rendering something wrong
- Verifies that source paths cited in the spec actually exist, via `--repo-root`
- Output is self-contained: pan/zoom, theming and per-subsystem views, no
  server, no assets

```bash
# validate, then render
node .claude/skills/archify/bin/archify.mjs validate architecture \
  docs/DIAGRAMS/architecture-diagram.json --quality showcase --repo-root . --json

node .claude/skills/archify/bin/archify.mjs deliver architecture \
  docs/DIAGRAMS/architecture-diagram.json \
  docs/DIAGRAMS/architecture-diagram.html --quality showcase --repo-root .
```

A passing `showcase` validation reports 9 artifact checks with no errors and no
warnings.

**Why this repo needs it.** [ARCHITECTURE.md](ARCHITECTURE.md) carries a
hand-drawn ASCII diagram that is fine for reading in a terminal but cannot be
explored, and nothing checks it against the code. The archify spec names real
files — `src/App.tsx`, `src/audio/SynthEngine.ts`, `src/vision/useHandTracking.ts`
— and `--repo-root` makes it verify they exist before drawing. Rename a module
and the diagram fails validation rather than quietly lying, which is the whole
reason it is worth keeping a second diagram at all.

### impeccable

Frontend design work: audit, critique, and targeted refinement passes over the UI.

**Main things it does**

- ~23 commands; the ones that matter here are `audit` (a11y, performance,
  responsive), `polish`, `typeset`, `colorize`, and `document`
- Wrote [DESIGN.md](../DESIGN.md) and its sidecar from the shipped code, so the
  design system is derived from what actually renders
- Ships a detector that flags common UI slop, and four subagents in
  `.claude/agents/`
- `doctor` reports drift between its artifacts and the installed version

```
/impeccable audit src/components/SettingsPanel.tsx
/impeccable polish src/components/Hud.tsx
```

```bash
node .claude/skills/impeccable/scripts/doctor.mjs --json
```

**Why this repo needs it.** There is no designer on this project — one person
maintains both the instrument and the interface. The 1980s-console direction came
out of an Impeccable redesign, and DESIGN.md records it as enforceable rules
rather than taste: a closed four-ink list where each colour means exactly one
thing, depth by inset bevel only, one typeface working its width axis. Those are
easy to violate by accident and hard to notice one commit at a time, so having
the rules written down *and* a tool that checks against them is what keeps the
panel looking like one machine.

## Vendoring a skill

There is no installer script here. Copy the folder in and commit it:

```bash
git clone --depth 1 https://github.com/<owner>/<skill>.git /tmp/<skill>
rm -rf /tmp/<skill>/.git
cp -R /tmp/<skill> .claude/skills/<skill>
```

Record where it came from in [skills-lock.json](../skills-lock.json), so a
vendored copy is distinguishable from local edits:

```json
{
  "version": 1,
  "skills": {
    "archify": {
      "source": "tt-a1i/archify",
      "sourceType": "github",
      "computedHash": "af17a3cff89ff82a215b6df944c6a92d428652f31cbc0d95a9167ffab944404f"
    }
  }
}
```

Two things to check before committing:

- **Does it ship subagents?** Impeccable does — its four `impeccable-*.md` files
  belong in `.claude/agents/`, not in the skill folder.
- **Does it write scratch files?** Impeccable writes to `.impeccable/`. The
  throwaway parts are in [.gitignore](../.gitignore); the durable parts
  (`config.json`, `design.json`, `surfaces/`) are committed on purpose.

Verify it loads:

```bash
node .claude/skills/archify/bin/archify.mjs doctor
```

## Keeping vendored skills current

Archify ships a checker that only *reports* — it never downloads or installs:

```bash
node .claude/skills/archify/scripts/check-update.mjs
```

```json
{"status":"silent","reason":"current"}
```

An `update_available` means re-vendoring by hand with the steps above, and
bumping `computedHash` in the same commit.

Impeccable updates itself through its own CLI:

```bash
npx impeccable update
```
