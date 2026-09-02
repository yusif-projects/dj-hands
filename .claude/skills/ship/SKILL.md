---
name: ship
description: Stage everything, commit, and push to the current branch. Use when the user says "ship it", "commit and push", "push this up", or asks to commit all pending work in one step.
---

# Ship

Stage all changes, commit them with a message that matches this repo's style, and
push to the branch the user is already on.

## Steps

### 1. Look before you stage

```bash
git status --short && git diff --stat HEAD && git branch --show-current
```

Read the actual diff of anything non-obvious before writing the message — the
message describes the change, so you need to know what the change is.

`git add -A` stages *everything*, including files you did not touch. Scan the
status output for things that should not be committed:

- Secrets, `.env*` files with real values, credentials, tokens
- Large binaries or vendored assets (in this repo `public/models/` and
  `public/wasm/` are gitignored on purpose — they are fetched at build time)
- Unrelated work in progress from another task

If anything looks like it does not belong, stop and ask rather than committing it.

### 2. Stage

```bash
git add -A
```

### 3. Commit

```bash
git commit -m "<message>"
```

Messages in this repo are [Conventional Commits](https://www.conventionalcommits.org).
The `commit-msg` hook rejects anything else, so a message that does not parse is
a failed commit, not a style note.

```
type(optional scope)!: description
```

- **Type**, required — one of `feat` `fix` `perf` `refactor` `docs` `test`
  `build` `ci` `style` `chore` `revert`
- **Scope**, optional and lowercase — usually the source directory the change
  lives in (`audio`, `vision`, `state`, `components`), or `deps`, `deploy`,
  `skills`
- **Description** — imperative and lowercase ("add", "fix", not "Added" or
  "Adds"), the whole header under 72 characters, no trailing period, about the
  **user-visible change** rather than the files touched

```
feat(audio): add a phaser to the effects rack
fix(vision): fall back to CPU inference when the GPU delegate fails
build(deps): pin oxlint to 1.79
docs: split the README into a docs/ set
```

**Pick the type honestly — it sets the version.** The deploy tags a release from
the log: `feat` moves the minor number, a `!` before the colon or a
`BREAKING CHANGE:` footer moves the major, everything else moves the patch. A
capability committed as a `chore` ships under a patch bump.

A change that spans types takes the type of what a user would notice first — a
`feat` that also touches the docs is a `feat`. If two unrelated things are
staged, that is two commits, not one message with a comma in it.

Add a body only when the *why* is not obvious from the subject, separated from
the header by one blank line. A breaking change is footed on its own line:

```
feat(state)!: store the effects rack as an ordered list

BREAKING CHANGE: v4 settings blobs lose their effect order.
```

The hook checks the message as it is committed. To check a whole branch before
opening a pull request — CI runs the same thing:

```bash
npm run check-commits -- --range main..HEAD
```

Do not add co-author trailers or any other generated-by attribution — no
`Co-Authored-By: Claude`, no `Claude-Session:`, no "Generated with Claude Code".
This is not a preference: `.claude/settings.json` disables the trailer and the
`commit-msg` hook rejects the commit if one appears. A trailer naming a human
co-author is fine.

If the commit fails because nothing is staged, say so — do not create an empty
commit.

### 4. Push to the current branch

```bash
git push
```

If the branch has no upstream, set it in the same command:

```bash
git push -u origin "$(git branch --show-current)"
```

Never push to a branch other than the one that is checked out, and never force
push unless the user explicitly asks for it.

If the push is rejected as non-fast-forward, stop and report it. Do not pull,
rebase, or merge to resolve it on your own — tell the user the remote has moved
and let them choose.

## Pushing to `main` deploys the site

`.github/workflows/deploy.yml` runs on every push to `main` and publishes to
GitHub Pages at [www.dj-hands.com](https://www.dj-hands.com). There is no
staging environment and no test job in CI.

So when the current branch is `main`:

- Run the checks first — `npm run lint`, `npm test`, `npm run build`. A broken
  build on `main` is a broken deploy.
- Confirm with the user before pushing, unless they already said to ship, deploy,
  or push to production in this conversation.

On any other branch, push freely — nothing deploys.

## Report back

One line: the commit subject, the branch, and — if it was `main` — that a deploy
is now running. Link the Actions run if you have it.
