---
name: release
description: Create a GitHub issue, branch, validate, review, open a PR, merge, tag, and publish a release for this app.
user-invocable: true
allowed-tools: Bash(git describe *), Bash(git rev-list *), Bash(git merge-base *), Bash(git branch --show-current), Bash(git fetch), Bash(git fetch *), Bash(git pull), Bash(git pull *), Bash(git checkout -b *), Bash(git checkout main), Bash(git add *), Bash(git commit -m *), Bash(git push), Bash(git push -u origin *), Bash(git push origin v*), Bash(git tag v*), Bash(git status *), Bash(git log *), Bash(git diff *), Bash(gh issue *), Bash(gh pr *), Bash(gh release *), Bash(gh run *), Bash(gh repo view *), Bash(gh api repos/*/milestones*), Bash(pnpm check), Bash(pnpm check *), Bash(pnpm lint), Bash(pnpm format:check), Bash(pnpm test), Bash(pnpm build), Bash(pnpm build *), Bash(pnpm preview), Bash(pnpm version *), Bash(mktemp -d), Bash(node scripts/release-guard.mjs *), Read, Write, Edit, Glob, Grep, AskUserQuestion, Task, TodoWrite
---

# Release Skill

Orchestrate a full release of the AWS Quiz Practice app: validation, GitHub issue, feature
branch, code review, PR, squash merge, tag, GitHub release.

**IMPORTANT:** Every interaction with the user MUST go through `AskUserQuestion`, never
plain text. Beyond the UX, this is what keeps the whole release inside a single turn: the
`allowed-tools` grant in this file's frontmatter is turn-scoped, and a plain-text question
answered as a new user message ends the turn and brings every permission prompt back.

**IMPORTANT:** `npm` and `npx` are blocked on this machine. Use `pnpm` / `pnpm dlx`.

## Repo Facts

Everything below assumes these. Check them if something does not line up.

| Fact         | Value                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Repo         | [`oharu121/quiz-practice`](https://github.com/oharu121/quiz-practice) — public, default branch `main` |
| Stack        | SvelteKit 2 + Svelte 5 runes, Vite 8, `@sveltejs/adapter-static` with `fallback: 'index.html'`        |
| Config       | No `svelte.config.js` — SvelteKit is configured inline in [vite.config.ts](../../../vite.config.ts)   |
| Build output | `build/`, served by Vercel as a static SPA                                                            |
| Deploy       | Vercel's Git integration, direct from `main`. **Merging to `main` deploys to production.**            |
| CI           | [.github/workflows/ci.yml](../../../.github/workflows/ci.yml)                                         |

## Path Variables

Both are **placeholders you substitute**, not shell variables. Writing `$SCRATCH` in a
command leaves it unset, and `gh` is handed `/issue-body.md`.

- `SKILLS_DIR` = `.claude/skills/release`
- `<SCRATCH>` = the session scratchpad directory from your environment, spelled out as an
  absolute path in every command. If none is given, use `mktemp -d` and keep the path it
  prints. **Never write scratch files inside the repo** — they get swept into `git add`,
  need a `.gitignore` entry, and need cleanup that can be skipped on an abort.

## Command Shape

The `allowed-tools` line in this file's frontmatter pre-approves the exact command shapes
this skill uses, so a release runs start to finish without permission prompts. A rule is a
literal glob over the whole command string, matched against each subcommand separately.
The separators are `&&`, `||`, `;`, `|`, `|&`, `&`, and **newlines**. Three habits keep it
working:

- **Never assign a shell variable.** `BRANCH=$(git branch --show-current)` and
  `BODY_LEN=$(...)` cannot be matched by any rule — an allow rule stops at an assignment.
  Inline the literal value you already hold: the branch name from Step 10.6, the tag from
  Step 4.
- **One command per Bash call.** No `if`, no `$( )` nested inside another command. Guards
  that need a real non-zero exit live in
  [scripts/release-guard.mjs](../../../scripts/release-guard.mjs) — call that instead of
  inlining `if [ … ]; then exit 1; fi`. A `&&` or `||` chain is allowed only when _every_
  fragment stands on its own; Steps 4 and 14 chain onto `echo`, which is a built-in
  read-only command and needs no rule.
- **Keep every `|` inside quotes.** A quoted pipe in a `--jq` filter is fine; an unquoted
  one splits the command, and each half then has to match a rule on its own.

**Write one `Bash(...)` per rule.** `Bash(a *, b *)` is not two rules — it is a single
rule whose pattern is the literal string `a *, b *`, which no command can match, and it
fails silently by prompting exactly as if the line were absent. Verified on Claude Code
2.1.193: `--allowed-tools "Bash(mktemp -d)"` allows `mktemp -d`, and
`--allowed-tools "Bash(mktemp -d, git describe *)"` denies it.

A trailing `*` also matches flags appended _after_ the intended argument, so
`Bash(git push -u origin *)` does cover `git push -u origin main --force`. Globs cannot
express "and nothing else"; the rules narrow the surface, they do not seal it.

Adding a command to this skill means adding its shape to `allowed-tools`.

## Fixed Settings

These are constants for this repo. There is no config file — a release flow is
repo-specific, so an indirection layer whose every value is fixed buys nothing. For the
same reason the validation commands are inlined in the **Validation** section below rather
than living in a pattern file of their own: there is only one pattern, and it is this one.

**Every row is read by the step named beside it.** Edit a row and the flow
changes — that is the contract. Never add a row no step reads.

| Setting        | Value                                                              | Read by     |
| -------------- | ------------------------------------------------------------------ | ----------- |
| Language       | **English**                                                        | Steps 5, 14 |
| Commit message | **`auto`** — set to `ask` to approve the message before committing | Step 12     |
| Push + PR      | **`auto`** — set to `ask` to approve before pushing                | Step 13     |
| Merge          | **`auto`** — set to `ask` to restore the merge confirmation        | Step 13.5   |
| Release title  | **`v<version> - <plan title>`** — a template, not a switch         | Step 14     |

The `auto` rows default that way because each question carried no information:
the commit message and the release title derive from a title already chosen at
Step 2, squash is the only strategy this repo uses, and pushing a feature branch
to a repo with no branch protection is reversible and is not a deployment.

The merge is the one with real stakes — **merging to `main` triggers a Vercel production
deploy** — so `auto` is not unconditional. Step 13.5 falls back to asking whenever the
review left something a human has to settle: a 🔴 finding the owner chose to continue past,
or an `Unverifiable` verdict that only a person looking at the running app can decide.
It merges silently only when CI is green **and** the review came back clean.

Note what `auto` does not rest on. Step 12.5 does not _block_ on a 🔴 — it offers
"continue anyway" — so without the fallback nothing would stand between that answer
and production. That is why `auto` is conditional rather than flat.

Do not add a confirmation gate to a step that has no row. Validation, the PR body
and the release body are assembled and run without asking.

### What is still asked, and why

**A gate that is always approved is not a gate.** The questions that remain are
the ones where the answer actually varies:

| Step | Question               | Why it stays                                                                                                 |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| 2–4  | Title, labels, version | Editorial and semantic. Ask them in **one** `AskUserQuestion` — the tool takes up to four questions per call |
| 12.5 | Code review found 🔴   | The step most likely to catch a defect the tooling cannot                                                    |

The title stays asked even though the commit message derived from it does not.
They are not the same decision: the title is editorial and gets rejected in
practice, while the message is a format applied to whatever title won.

**Read the CI caveat at Step 13.5 before trusting a green run.** `paths-ignore` skips the
workflow entirely for a change confined to `.claude/**`, `.plans/**`, `README.md`,
`CHANGELOG.md` or `CLAUDE.md`.

**Language** applies to the issue body, plan file, PR body, and release notes. Commit
messages always stay English regardless of this row — that is git convention, not a
preference. To ship one release in another language without editing this row, say so when
invoking `/release`; a direct instruction outranks the table.

---

## Validation

**Summary for the Phase 0 announcement:** type check, lint, format check, unit tests, and
a production build.

These are deliberately the same five commands, in the same order, that
[.github/workflows/ci.yml](../../../.github/workflows/ci.yml) runs. The release gate and
CI should never disagree about whether the tree is good.

```bash
pnpm check         # svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
pnpm lint          # eslint .
pnpm format:check  # prettier --check .
pnpm test          # vitest run
pnpm build         # vite build -> build/
```

Each one covers ground the others do not, so none is redundant:

- `pnpm check` is TypeScript and Svelte diagnostics only. Its scope is
  `.svelte-kit/tsconfig.json`'s include list — `src/**`, `vite.config.ts`, `test/**`. It
  does **not** reach `scripts/`.
- `pnpm lint` does reach `scripts/`, which is where `release-guard.mjs` and
  `generate-icons.mjs` live. ESLint's own ignore list is `build/`, `.svelte-kit/`,
  `node_modules/`, `.vercel/`.
- `pnpm format:check` is a separate script here, not folded into `check`.
  [.prettierignore](../../../.prettierignore) excludes the generated question dumps.
- `pnpm test` runs the Vitest suites (`src/lib/utils.test.ts`, `src/lib/backup.test.ts`).
- `pnpm build` is not redundant with `check`: `vite build` does not typecheck, and
  `check` does not bundle. A build-only failure — a bad import, an adapter problem — is
  invisible until this step.

**This is the main validation step.** The only later re-run is Step 12.6, and only when
code review produced edits.

### On Failure

Show the failing output first, then use AskUserQuestion:

- "Validation failed. How do you want to proceed?"
- Options: "Fix first (cancel release)", "Skip validation and continue"

### On Pass

State: "Validation passed (`check`, `lint`, `format:check`, `test`, `build`)." and continue.

### Version Bump

When Step 11 runs:

```bash
pnpm version <patch|minor|major> --no-git-tag-version --no-git-checks
```

`--no-git-tag-version` updates `package.json` without committing or tagging, so the skill
controls both. Step 11 then commits the bump on its own as `Bump version to <version>`,
Step 12 commits the release changes, and the tag is created in Step 14 **after** the
squash merge lands on `main`.

`--no-git-checks` is **required**, not optional. `pnpm version` aborts with
`ERR_PNPM_UNCLEAN_WORKING_TREE` when anything is uncommitted, and Step 11 runs _before_
Step 12 commits the release changes — so the tree is dirty every single time.

### Drift Check

Before bumping, verify the file version matches the latest git tag. You already hold both
values: the tag from Step 4, and `version` in `package.json`, which you read with the
**Read tool**. Compare them yourself.

Do not shell out to `FILE_VER=$(node -p …)` / `TAG_VER=$(… | sed …)`. No permission rule
can match an assignment, so that snippet costs a prompt every release — to re-derive two
values already in context.

If they differ, warn the user and ask which to use as the base for the bump.

Drift here is often the **tag-isolation** symptom described in "Tag Ordering" below: a tag
created on a feature branch that squash merge orphaned, so `git describe` reports an older
version than `package.json`. If the versions differ that way round, check
`git merge-base --is-ancestor v<tag> main` before assuming `package.json` is wrong.

---

## Tag Ordering — read before touching Step 11 or 14

**Never create the tag on the feature branch.** Squash merge does not merge your commit;
it replays the diff as a _new_ commit on `main` with a new SHA and discards the branch. A
tag made on the branch then points at a SHA that is not an ancestor of `main`:

- `git describe --tags --abbrev=0` cannot see it — and **Step 4 of the next release reads
  exactly that command**, so every later release computes its version from a stale base.
- The commit never appears in `git log main`. After `git branch -D` it is unreachable,
  kept alive only by the orphan tag.

The tag is therefore created in **Step 14**, on `main`, after the merge has landed and
been pulled. Step 11 bumps the version but does not tag. Step 13 pushes the branch but
does not push tags.

---

## Reusable Patterns

### Pattern: Safe GitHub Body Write

Both issue and release creation use this pattern. **NEVER use `--body` or bash heredocs** —
markdown content with backticks, tables, and special characters breaks quoting.

1. Use the **Write tool** to write content to `<SCRATCH>/<filename>.md`
2. Pass `--body-file "<SCRATCH>/<filename>.md"` to the `gh` CLI, with `<SCRATCH>` spelled
   out as an absolute path — `gh` does not care where the file lives
3. Verify the body actually landed:
   ```bash
   node scripts/release-guard.mjs body-check <issue|pr|release> <id>
   ```
   It prints the character count, and exits non-zero if the body is empty.
4. **Non-zero exit means STOP** — do not continue the release flow

### Pattern: Detect an In-Progress Release

A release that aborted mid-flow left its state in git and GitHub, not in a file. Read it
back from there — do not keep a state file. Every value a state file would hold is already
authoritative somewhere else, and a cached copy can disagree with reality after a manual
merge, a force-push, or an issue closed in the browser.

```bash
git branch --show-current
git status --porcelain .plans/
```

Two signals, because the branch is not created until Step 10.6:

- **Current branch is not `main`** → a release got at least to Step 10.6.
- **An untracked file under `.plans/`** → a release got to Step 5 but aborted before the
  branch existed. This is the window where restarting blind would create a **duplicate
  issue**, so do not skip this check just because you are on `main`.

  `.plans/` also holds working documents that are not release plans, and a new one looks
  identical to an aborted release. Confirm before offering to resume:

  ```bash
  gh issue list --state open --assignee @me --search "<slug>"
  ```

  No matching issue and no branch means it is a document, not a release. Say so and
  carry on rather than proposing a resume.

Either signal means one is underway. Recover the rest:

| Value          | Where to read it back from                                            |
| -------------- | --------------------------------------------------------------------- |
| Slug           | The branch name after its prefix, or the untracked `.plans/` filename |
| Title, context | Read the plan file — it holds everything Steps 1–5 produced           |
| Issue          | `gh issue list --state open --assignee @me --search "<slug>"`         |
| Version base   | `git describe --tags --abbrev=0`                                      |
| Bump done?     | `git log main..HEAD --oneline --grep '^Bump version'`                 |
| PR             | `gh pr list --head <branch> --json number,url,state`                  |

Then use AskUserQuestion:

- "Found an in-progress release for `<slug>` (issue #N, PR #M). Resume?"
- Options: "Yes, resume" (Recommended) / "No, start fresh"

If "start fresh": ask whether to close the orphaned issue and delete the branch before
proceeding from Phase 0. Do neither silently.

---

## Phase 0: Startup

### 0a: Check for an In-Progress Release

Follow the **Detect an In-Progress Release** pattern above. If resuming, skip to the phase
that matches what already exists.

### 0b: Announce Validation

State what will run (`pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
`pnpm build`) and continue. Do not gate on a confirmation — the user invoked `/release`,
which already implies it.

---

## Phase 1: Context + Planning

### Step 1: Gather Context

Read back through the session for what to put in the plan file (Step 5) and the issue
(Step 6b) — `templates/plan.md` is the authoritative structure for what that needs.

### Step 2: Ask for Title

Use AskUserQuestion:

- 3 suggested titles (concise, action-oriented)
- "Other" option for free input

### Step 3: Ask for Labels

Use AskUserQuestion with multiSelect=true:

- Options: enhancement, bug, documentation, refactor
- "Other" for custom labels (comma-separated)

### Step 4: Ask for Version

Read current version from git tags:

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"
```

If this disagrees with `package.json`, see the **Drift Check** in the Validation section —
the usual cause is an isolated tag from a previous release.

Strip the `v` prefix to get the current version number. Use AskUserQuestion:

- patch: v{x}.{y}.{z+1}
- minor: v{x}.{y+1}.0
- major: v{x+1}.0.0
- Skip (no tag or release)

Always prefix with "v". **Store the selected version** for later steps.

### Step 5: Create Plan File

Read `SKILLS_DIR/templates/plan.md` for the template and rules.

Create `.plans/<slugified-title>.md` filled with real content from the session.
Write all narrative content in the **Language** from Fixed Settings. Section headings may
stay in English for template consistency, but all prose follows that setting.

**All file links must be absolute `https://github.com/oharu121/quiz-practice/blob/main/...`
URLs.** This file is copied verbatim into the GitHub issue (Step 6b) and the PR body
(Step 13). Both render at a path where a repo-relative link resolves wrongly and 404s.
Resolve the base once here and reuse it for the issue, PR, and release notes:

```bash
gh repo view --json url -q .url
```

**Store the slug** — Step 10.6 reuses it as the branch name.

### Step 6: Create GitHub Issue

#### 6a: Handle Milestone (if version selected)

```bash
gh api repos/oharu121/quiz-practice/milestones --jq '.[] | select(.title == "<version>") | .title'
```

If missing:

```bash
gh api repos/oharu121/quiz-practice/milestones -f title="<version>" -f state="open"
```

#### 6b: Create the Issue

Read `SKILLS_DIR/templates/issue-body.md` for the body format.

Follow the **Safe GitHub Body Write** pattern:

1. Write issue body to `<SCRATCH>/issue-body.md`
2. Create issue with `--body-file "<SCRATCH>/issue-body.md"`
3. Verify body is not empty

```bash
gh issue create \
  --title "<title>" \
  --label "<labels>" \
  --assignee "@me" \
  --milestone "<version>" \
  --body-file "<SCRATCH>/issue-body.md"
```

Omit `--milestone` if version was skipped.

**Verify:**

```bash
node scripts/release-guard.mjs body-check issue <issue-number>
```

Non-zero exit means the body is empty — stop, do not continue.

### Step 7: Generate Commit Message

```
feat(<scope>): <description> (#<issue-number>)
```

Use `fix()` for bugs, `docs()` for documentation, `refactor()` for refactoring.

Output: `Issue created: <url> — proceeding with validation...`

---

## Phase 2: Validation

### Step 8: Check Remote Status

```bash
git fetch
git rev-list --count HEAD..@{u}
```

If remote has new commits, use AskUserQuestion:

- "Remote has new commits. Pull with rebase before continuing?"
- Options: "Yes, pull --rebase", "No, continue anyway", "Cancel"

Pull: `git pull --rebase` — stop on merge conflicts.

### Step 9: Run Validation

Run the five commands in the **Validation** section above, in order.

If validation fails, stop — do not continue until resolved.

### Step 10: Update README and CHANGELOG

#### 10a: README.md

Check whether [README.md](../../../README.md) needs updating:

- A new route, script, or top-level directory not reflected in the Layout tree
- A `package.json` script added, renamed, or removed — the Commands block lists them
- A stack change (adapter, test runner, deploy target) that contradicts the Stack table
- A question-schema change, which the Question data section describes

#### 10b: CHANGELOG.md

`CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/):
reverse-chronological, ISO 8601 dates, the six categories (Added / Changed / Deprecated /
Removed / Fixed / Security), an `[Unreleased]` section, and link refs at the bottom.

First, **sweep for what actually landed** since the last tag — not just what this session
did. Use the tag you already read in Step 4, spelled out:

```bash
git log v<last-tag>..HEAD --format='%h %s'
```

Do not nest `$(git describe --tags --abbrev=0)` inside the range — the substitution makes
the command unmatchable by any permission rule, and you already hold the value.

Commits can reach `main` without going through this skill — a hotfix pushed directly, a
merge done in the browser — so without this sweep the CHANGELOG drifts from reality.
Anything found that is not already recorded belongs under `[Unreleased]`.

Then:

- **Version selected** → promote `[Unreleased]` to `## [<version>] - <YYYY-MM-DD>`, merge
  this release's entries into it, and leave a fresh empty `[Unreleased]` above.
- **Version skipped** → append this release's entries to `[Unreleased]` and stop.

Update the link refs at the bottom in both cases: repoint `[unreleased]` to
`compare/v<new>...HEAD`, and add `[<new>]: .../compare/v<old>...v<new>`.

Use the **Edit tool**, not `sed` — the file is hand-maintained prose.

**Rules:**

- Entries describe user-visible effect, not commits: "Added an unanswered filter to the
  question list", not "add FilterBar unanswered branch".
- **Individual question edits never get an entry** — [`CHANGELOG.md`'s own header
  note](../../../CHANGELOG.md) already says why. A change to the question _schema_ does
  get one; a correction to a question's text does not.

Both files land in the same commit as the code.

### Step 10.6: Create Feature Branch

```bash
git branch --show-current
```

**Only if the current branch is `main`**, create one. If already on a `feat/`, `fix/`,
`docs/`, or `refactor/` branch, skip — the user started it deliberately.

```bash
git checkout -b <prefix>/<slug>
```

`<slug>` is the plan-file slug from Step 5; `<prefix>` matches the commit type from Step 7
(`feat`, `fix`, `docs`, `refactor`).

**Keep the branch name literally.** Steps 13 and 13.6 must type it out — recomputing it
with `$(git branch --show-current)` costs a permission prompt for no gain.

---

## Phase 3: Release

### Step 11: Bump Version

**"Skip" in Step 4:** skip this step entirely.

**Otherwise:** follow the "Version Bump" part of the **Validation** section.

```bash
pnpm version <patch|minor|major> --no-git-tag-version --no-git-checks
```

Commit the version bump separately:

```bash
git add package.json
git commit -m "Bump version to <new-version>"
```

**Do not tag here.** See "Tag Ordering" above.

### Step 12: Commit Release Changes

```bash
git status --short
```

Read the **Commit message** row in Fixed Settings. On `auto`, state the message and
what you are staging, then commit. On `ask`, confirm the message with
AskUserQuestion first.

```bash
# Stage only release-relevant files shown by git status
git add <specific-files>
git commit -m "<commit-message>"
```

**Stage by name, never `git add -A`.** A session leaves unrelated state behind — a
rewritten `.claude/settings.local.json` is the usual one. This repo's `.gitignore` does not
cover it; it is hidden only by a `**/.claude/settings.local.json` line in this machine's
global git ignore, which is not part of the repo and will not be there in another clone.
Anything in `git status` you did not put there is reported, not committed.

### Step 12.5: Code Review

```bash
git diff main...HEAD
```

If the diff is empty, note it and skip — you are probably still on `main`.

Fetch the Acceptance Criteria, substituting the issue number from Step 6b as a
literal — an assignment like `N=$(…)` matches no allow rule and reintroduces a prompt:

```bash
gh issue view 42 --json body --jq .body
```

The AC exist **only** in the issue body. Step 6b wrote them there, the plan file has never
carried them, and Dimension 7 is inert without them — it skips rather than guessing, so a
forgotten fetch reads as a clean review instead of an error.

Spawn a subagent with the Task tool. Pass it the full diff, the issue body from the command
above, and the contents of `SKILLS_DIR/review-checklist.md` as its instructions.

Display the result, then:

- **🔴 High findings, including any unmet AC** → AskUserQuestion: "High-severity issues
  found. Fix before releasing?" Options: "Yes, fix first (abort release)" / "No, continue
  anyway".
- **🟡/🟢 only** → AskUserQuestion: "Medium/low findings. Fix now?" Options: "Yes, fix" /
  "No, continue".
- **Nothing found** → state "✓ Code review passed." and continue.

**An `Unverifiable` verdict is not a pass.** Carry those criteria into Step 13 and check
them against the running app — the PR's Vercel preview, or a local `pnpm build &&
pnpm preview`. That is the step that can settle them.

If the user aborts, leave the branch in place. Phase 0 detects it and offers to resume
after the fixes.

### Step 12.6: Re-validate and Re-document After Review Edits

**Only if Step 12.5 produced edits.** Otherwise skip — nothing has changed since Step 9.

```bash
pnpm check
pnpm lint
pnpm test
```

Commit any fixes before continuing. On failure: stop, show the error.

Re-run `pnpm format:check` too if the fix touched formatting-sensitive files, and
`pnpm build` if it touched anything the bundler resolves.

**Then update the two documents the review just invalidated.** Both were written before
Step 12.5 ran, so a fix the review produces is by definition absent from each, and nothing
between here and the end of the flow reads either file again except to _copy_ it.

#### The CHANGELOG, if a user of the app would notice the fix

Ask one question of each fix: **would someone using the app notice?** If yes, it needs an
entry. A refactor with no visible effect does not.

Step 14 copies the CHANGELOG section into the release notes verbatim, so a stale CHANGELOG
becomes stale release notes — the two do not drift apart, they are wrong together, which
is harder to notice than a mismatch.

**Edit the section 10b already wrote, not the step.** Add the entry to the promoted
`## [<version>]` section, or to `[Unreleased]` when Step 4 selected Skip. Do not re-run
Step 10b itself: it begins with the drift sweep and then promotes `[Unreleased]` and
rewrites the link refs, all of which have already happened by now, and doing them twice
produces a duplicate section and duplicate refs.

#### The plan file, if the review changed what it describes

Same hazard, one document over, and a wider blast radius: the plan is embedded verbatim in
the **issue** (Step 6b) and again in the **PR body** (Step 13), so a stale plan misinforms
two places. Step 5 wrote it long before the review existed.

The test is not "would a reader notice" — nobody reads a plan file for pleasure — but
**does it still describe the code that is about to merge?** A review fix that changes the
mechanism, not just a line of it, makes the Approach or Changes sections wrong. Update
those, and the Guard Rails and Verification tables with them.

Do not re-run Step 5. Edit the file in place; its Context section is still true, and the
review finding usually belongs _in_ the narrative rather than replacing it — a plan that
records what the review caught is worth more than one that pretends the first attempt was
right.

#### Then commit both — and re-sync the issue

Step 12 has already run, so these edits are staged by nothing. Anything written here and
left uncommitted never reaches the PR, and validation passes either way:

```bash
git add CHANGELOG.md .plans/<slug>.md
git commit -m "docs: <what the review fix changed> (#<issue-number>)"
```

**Committing repairs the PR body and not the issue.** Step 13 rebuilds the PR body from
the plan file, so a corrected plan reaches the PR for free — but the issue body was
written once at Step 6b from a copy taken before the review existed, and nothing re-reads
it. Push the corrected plan there too, or the "two places" this subsection opens with is
still two places and only one of them is right:

```bash
gh issue edit <issue-number> --body-file "<SCRATCH>/issue-body.md"
```

Rebuild `<SCRATCH>/issue-body.md` first, the same way Step 6b did — the corrected plan
file followed by the unchanged Acceptance Criteria. Skip this only when the review changed
nothing the plan describes.

**Neither of these is hypothetical.** Both were observed in
[oharu-tech-blog](https://github.com/oharu121/oharu-tech-blog), the repo this flow was
written in and ported from:

- In **v0.33.0** the review caught a real defect; the fix shipped, but the CHANGELOG was
  never updated, and `CHANGELOG.md` had to be patched directly on `main` after the tag
  already existed — so `git show v0.33.0:CHANGELOG.md` still returns the incomplete version.
- In **v0.33.1** the review changed the approach; the code fix shipped, the plan file still
  described the discarded one. It was noticed at Step 13 while assembling the PR body —
  _after_ the push — so the correction was committed and never sent. See Step 13's push
  guard, which now catches that half of it.

### Step 13: Push Branch and Open PR

Read the **Push + PR** row in Fixed Settings. On `auto`, push and open the PR. On
`ask`, confirm with AskUserQuestion first.

```bash
git push -u origin <branch>
```

`<branch>` is the literal name from Step 10.6. **Do not push tags here** — the tag does
not exist yet by design.

Write the PR body to `<SCRATCH>/pr-body.md`. **Then, immediately before creating the PR,
prove GitHub's copy of the branch is the one you are about to describe:**

```bash
node scripts/release-guard.mjs push-guard <branch>
```

Non-zero exit means the PR would not contain what is committed locally. **Read which of
the three states it names** — they do not share a remedy. Local ahead is the ordinary one
and wants another push; origin ahead wants a fast-forward pull; diverged wants hands. Do
not create the PR until it passes.

It asks the remote directly rather than trusting `origin/<branch>`, which is a local cache
this clone refreshes only on its own fetches and pushes. So it also needs the network: a
failure to reach origin is reported as a failure, not waved through.

This check is here rather than beside the push because the gap between them is the
dangerous part. Assembling the PR body means reading the plan file, which is when a stale
plan gets noticed and edited — after the push has already happened. `gh pr create` says
nothing about it: it opens the PR against whatever was pushed, and the squash merge lands
that. `body-check` does not cover it either, because Step 13 builds the body from the
**local** file — so the PR body can be correct while the file committed alongside it is a
version behind.

Then create the PR:

```bash
gh pr create --base main --head <branch> \
  --title "<commit message from Step 7>" \
  --body-file "<SCRATCH>/pr-body.md"
```

**PR body format** — embed the plan file's **full content**, not a link, so a reviewer has
the whole context on the PR page:

```markdown
Closes #<issue-number>

<full content of .plans/<filename>.md>

## Checklist

- [x] `pnpm check` passed
- [x] `pnpm lint` passed
- [x] `pnpm test` passed
- [x] `pnpm build` passed
- [x] Code review completed
```

**Verify:**

```bash
node scripts/release-guard.mjs body-check pr <pr-number>
```

Non-zero exit means the body is empty — stop, do not continue. This is the same
`--body-file` failure mode the Safe GitHub Body Write pattern exists to catch.

Report the PR URL. CI starts automatically ([.github/workflows/ci.yml](../../../.github/workflows/ci.yml)).

#### Looking at the change before it merges

`vercel.json` does **not** set `git.deploymentEnabled`, so Vercel's Git integration is
free to build a preview deployment for the branch, and the Vercel bot normally comments
the URL on the PR. Treat that as expected but not guaranteed — this has not yet been
observed on this repo, because it had no pull requests before this workflow existed. If no
preview appears within a couple of minutes, do not wait on it:

```bash
pnpm build
pnpm preview
```

`pnpm preview` is `vite preview`, serving `build/` — the same static output Vercel uploads,
so for this app it is the same bytes. Any `Unverifiable` acceptance criterion from
Step 12.5 gets settled here, whichever of the two you use.

### Step 13.5: Merge the PR

**Wait for CI to pass before merging.** Merging deploys: Vercel's Git integration builds
`main` on push, so the squash merge in this step is the production release.

```bash
gh run list --branch <branch> --limit 3 --json databaseId,name,status,conclusion --jq '.[] | "\(.databaseId)\t\(.name)\t\(.status)\t\(.conclusion)"'
gh run watch <run-id> --exit-status --interval 15
```

**Not `gh pr checks`.** It fails on this machine's `gh` token with
`GraphQL: Resource not accessible by personal access token`, and so does the
`repos/…/check-runs` REST endpoint. GitHub cannot currently issue a fine-grained
PAT carrying `checks:read`, so this is not fixable by re-scoping the token —
`gh run` reads the Actions API instead and works. `gh run watch` may still print a
403 for _annotations_; that line is the same token limit and is not a CI failure.

**What green covers.** `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test` and
`pnpm build` — nothing else. It is a static check of the bundle, not a test of the app in a
browser, so anything about rendering, gestures, `localStorage` or the service worker is
outside it. And `paths-ignore` skips the whole workflow for a change confined to
`.claude/**`, `.plans/**`, `README.md`, `CHANGELOG.md` or `CLAUDE.md` — where "no checks
reported" is the correct outcome rather than a problem. Weigh the merge on the review as
well as the badge.

If a check did report and failed, that is red CI — stop, do not merge.

If no run appears at all, prove it is the `paths-ignore` case rather than assuming:

```bash
gh pr diff --name-only <pr-number>
```

Every path must match an entry in that list. If even one does not, CI should have
run — stop and investigate rather than merging.

Then read the **`Merge`** row in Fixed Settings.

**Ask first if the row is `ask`, or if either of these is true regardless of the row:**

- Step 12.5 reported a 🔴 finding and the answer was "continue anyway". Step 12.5 does
  not block — it offers that option — so nothing else stands between the finding and
  production.
- Any acceptance criterion came back `Unverifiable`. Those are settled by looking at the
  running app, which Step 13 covers. Merging past one ships a change nobody has looked at.

```
- "CI is green. Merge the PR?"
- Options: "Yes, squash merge now", "No, I'll merge on GitHub", "Cancel"
```

Name the reason in the question when a fallback triggered it — "CI is green, but AC-2 is
Unverifiable" — so the answer is about the finding rather than the merge.

On "Yes", run the command below. On "No", confirm completion with AskUserQuestion before
continuing. On "Cancel", stop the release with the branch and PR left in place; Phase 0
detects them and offers to resume.

**Otherwise merge without asking:**

```bash
gh pr merge <pr-number> --squash --delete-branch
```

**The strategy is fixed on every path.** The row and the fallbacks switch whether the
question is asked, never how the merge is done — `--squash --delete-branch` is the only
form this repo uses, and Step 13.6's cleanup assumes it.

If the merge fails, warn, tell the owner to merge on GitHub, and resume at Step 13.6 once
they confirm. **Do not skip ahead** — Steps 13.6 and 14 must still run.

### Step 13.6: Sync main and Clean Up the Branch

```bash
git checkout main
git pull
git fetch --prune
node scripts/release-guard.mjs branch-cleanup <branch>
```

`gh pr merge --delete-branch` in Step 13.5 normally does the cleanup itself — it checks
out the default branch and deletes the feature branch both locally and on the remote. So
the first three commands here are usually no-ops, and `branch-cleanup` usually reports
`already gone` twice.

They still run because the paths that bypass `gh` exist: a merge done in the browser, a
merge without `--delete-branch`, or a repo setting that re-creates the remote branch.

**Do not call `git branch -D` directly.** On a clean release the branch is already gone
and that command exits 1 with `branch '<name>' not found` — a real failure exit for the
expected outcome, which is how a reader learns to ignore the one release where it means
something. `branch-cleanup` deletes each copy only if it is actually there, uses `-D`
rather than `-d` (squash merge rewrites the diff onto a new SHA, so git never considers
the branch merged), refuses to touch `main`/`master`, and refuses to delete the branch
you are standing on.

It exits non-zero only when a local branch that exists could not be deleted. A remote
delete that fails is reported and tolerated — by this point the release has already landed
and been tagged, so a stale remote branch is untidy rather than broken.

### Step 14: Tag and Create the GitHub Release

**"Skip" in Step 4:** skip this step entirely.

Re-read "Tag Ordering" above if the reason for this ordering is unclear.

**First, verify HEAD is actually the merge commit.** A successful `git pull` does not
prove it — a concurrent push, or a merge GitHub has not finished writing, leaves you
tagging the wrong commit silently:

```bash
node scripts/release-guard.mjs tag-guard <pr-number>
```

Non-zero exit means HEAD is not the merge commit. **Do not tag.** Pull `main` again and
re-run it.

Then tag and push **that one tag**:

```bash
git tag v<new-version>
git push origin v<new-version>
```

`git push --tags` would push every stray local tag. Push the tag by name.

Confirm the tag is on `main`:

```bash
git merge-base --is-ancestor v<new-version> main && echo "tag is on main" || echo "TAG ISOLATED"
```

If it prints `TAG ISOLATED`, stop and investigate — do not create the release.

Create the release. Read `SKILLS_DIR/templates/release-notes.md` for the format; the
notes are derived from the CHANGELOG section promoted in Step 10b. Build `--title` from
the **Release title** row in Fixed Settings. Follow the **Safe GitHub Body Write**
pattern:

```bash
gh release create v<new-version> \
  --title "<Release title row, filled in>" \
  --notes-file "<SCRATCH>/release-notes.md"
```

The tag already exists, so `gh` attaches to it rather than creating one.

**Verify:**

```bash
node scripts/release-guard.mjs body-check release v<new-version>
```

Non-zero exit means the body is empty — stop, do not continue.

Write release notes in the **Language** from Fixed Settings.

### Step 15: Close the Issue

**Comment first, close second. Never `gh issue close --comment`.**

```bash
gh issue comment <issue-number> --body "Released in v<version>"
gh issue close <issue-number>
```

If version was skipped:

```bash
gh issue comment <issue-number> --body "Shipped in <commit-sha>"
gh issue close <issue-number>
```

These are the only two `--body` calls in this skill, and the only exception to
**Safe GitHub Body Write**'s blanket "never use `--body`". That rule guards markdown
bodies full of backticks and tables; these are fixed one-line strings with nothing in them
to quote. Anything longer than a line goes back to `--body-file`.

The two-command form is not defensive style. On the ordinary path `--comment` never fires
at all: Step 13's PR body opens with `Closes #<issue-number>`, so merging the PR in
Step 13.5 already closed the issue. `gh issue close` on an already-closed issue prints
`! Issue <repo>#<n> is already closed`, exits **0**, and **drops the comment silently** —
the flag is honoured only on the transition.

Nothing downstream notices. `body-check` covers the issue body, not its comments, and the
zero exit reads as success. So the failure mode is a release that looks complete and
leaves the issue with no record of which version shipped it.

`gh issue close` still runs after the comment, and is usually a no-op. It does real work
in exactly one case — a PR body edited by hand so that `Closes` no longer appears, which
is also the one case where the old single-command form would have worked. Keeping it costs
one command and removes the need to know which case you are in.

### Step 16: Clean Up

Nothing to remove from the repo — scratch files live in `<SCRATCH>`, outside it. Confirm the
tree is clean:

```bash
git status --porcelain
```

Anything left over here was not part of the release and should be reported, not deleted.

### Step 17: Output Success

**If version was tagged**, output as plain markdown prose (not a fenced code block).
Use markdown link syntax so URLs are clickable in the IDE:

> Release complete!
>
> - **Issue:** `[#N](full-issue-url)`
> - **PR:** `[#N](full-pr-url)`
> - **Version:** old → new
> - **Tag:** `vX.Y.Z` (on `main`)
> - **Release:** `[vX.Y.Z](full-release-url)`

**If version was skipped**, output as plain markdown prose:

> Changes merged!
>
> - **Issue:** `[#N](full-issue-url)`
> - **PR:** `[#N](full-pr-url)`
> - **Commit:** `commit-message`
>
> No version tag or GitHub release (skipped).

---

## Error Handling

| Scenario                                                                  | Action                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Remote fetch fails                                                        | Warn and continue                                                                                                                                                                                            |
| Pull conflicts                                                            | Stop, instruct to resolve manually                                                                                                                                                                           |
| Validation fails                                                          | Stop, AskUserQuestion: skip or fix                                                                                                                                                                           |
| Commit fails                                                              | Stop (likely pre-commit hook)                                                                                                                                                                                |
| Branch already exists                                                     | AskUserQuestion: reuse it, or pick a new name                                                                                                                                                                |
| Code review finds 🔴                                                      | AskUserQuestion: abort and fix, or continue at own risk                                                                                                                                                      |
| Push fails                                                                | Warn, show manual command                                                                                                                                                                                    |
| `push-guard` exits non-zero                                               | The PR would not contain what is committed. Follow the direction it names — local ahead: push again; origin ahead: `git pull --ff-only`; diverged: reconcile by hand. Re-run it, and only then create the PR |
| `push-guard` cannot reach origin                                          | Not a pass. The check is unverified, so the PR is unverified — fix the network or credentials and re-run                                                                                                     |
| PR create fails                                                           | Warn, provide the `gh pr create` command to run manually                                                                                                                                                     |
| CI red on the PR                                                          | Stop — do not merge. Fix, push, re-check                                                                                                                                                                     |
| `gh pr checks` returns `Resource not accessible by personal access token` | Expected, not a CI failure. No fine-grained PAT can carry `checks:read`. Use `gh run list` / `gh run watch`                                                                                                  |
| `gh run watch` prints a 403 for annotations                               | Same token limit. The run's own conclusion is still authoritative                                                                                                                                            |
| No Vercel preview appears on the PR                                       | Do not block on it. Verify against a local `pnpm build && pnpm preview` — it serves the same `build/` output                                                                                                 |
| PR merge fails                                                            | Warn, instruct to merge on GitHub, then resume at Step 13.6                                                                                                                                                  |
| HEAD ≠ merge commit at Step 14                                            | `tag-guard` exited non-zero — stop, do not tag. Re-pull `main`, re-run it                                                                                                                                    |
| `TAG ISOLATED` after tagging                                              | Stop, do not create the release. Delete the tag and re-tag on `main`                                                                                                                                         |
| Tag already exists                                                        | Stop, AskUserQuestion with next version suggestion                                                                                                                                                           |
| `branch-cleanup` prints `already gone` twice                              | Normal. `gh pr merge --delete-branch` did the cleanup in Step 13.5                                                                                                                                           |
| `branch-cleanup` reports a DELETE FAILED                                  | It printed the exact command to run by hand. A remote failure is tolerated; a local one exits non-zero                                                                                                       |
| gh not installed                                                          | Warn, provide manual release URL                                                                                                                                                                             |
| Issue body empty                                                          | `body-check` exited non-zero — stop, do not continue                                                                                                                                                         |
| Release body empty                                                        | `body-check` exited non-zero — stop, do not continue                                                                                                                                                         |
| A Bash call raises a permission prompt                                    | Note the exact command. Its shape is missing from `allowed-tools` — finish the release, then fix the frontmatter                                                                                             |
