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

Match the existing log. Messages in this repo are:

- **Imperative mood** — "Add", "Fix", "Rewrite", "Use", not "Added" or "Adds"
- **One line**, roughly under 72 characters, no trailing period
- **About the user-visible change**, not the files touched

Real examples from `git log`:

```
Add site metadata, brand icons, and Google Analytics
Fall back to CPU inference when the GPU delegate fails
Use relative asset paths so the build runs on any static server
Rewrite README with live demo, preset/chord tables, and layout
```

Add a body only when the *why* is not obvious from the subject.

Do not add co-author trailers or any other generated-by attribution.

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
