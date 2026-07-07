---
name: release
description: Create a GitHub issue, commit, tag, and push a release. Detects repo type and runs mode-specific validation with user confirmation at every step.
user-invocable: true
---

# Release Skill

Orchestrate a full release: repo detection, validation, GitHub issue, commit, tag, push.

**IMPORTANT:** Every interaction with the user MUST go through `AskUserQuestion`. Never
prompt with plain text and wait for a reply — always use the tool.

## Path Variables

- `SKILLS_DIR` = `.claude/skills/release`
- `CONFIG_FILE` = `.claude/skills/release/config.json`

---

## Reusable Patterns

### Pattern: Safe GitHub Body Write

Both issue and release creation use this pattern. **NEVER use `--body` or bash heredocs** —
markdown content with backticks, tables, and special characters breaks quoting.

1. `mkdir -p .release-tmp`
2. Use the **Write tool** to write content to `.release-tmp/<filename>.md`
   (use the absolute path for the Write tool, relative path for `gh`)
3. Pass `--body-file .release-tmp/<filename>.md` to the `gh` CLI
4. Verify the body was written:
   ```bash
   BODY_LEN=$(gh <resource> view <id> --json body --jq '.body | length')
   if [ "$BODY_LEN" -eq 0 ]; then
     echo "ERROR: Body is empty! Stop the release flow."
     exit 1
   fi
   echo "Body verified ($BODY_LEN chars)"
   ```
5. If length is 0, **STOP** — do not continue
6. Clean up `.release-tmp/` only after ALL bodies (issue + release) are verified

### Pattern: Resume State

On startup, check for `.release-tmp/state.json`. If it exists, offer to resume.

**State file schema:**

```json
{
	"phase": 1,
	"issue_number": 52,
	"issue_url": "https://github.com/...",
	"version": "0.30.0",
	"version_type": "minor",
	"commit_msg": "feat(agent): add context routing (#52)",
	"plan_file": ".plans/add-context-routing.md",
	"title": "Add context-based model routing",
	"labels": ["enhancement"],
	"language": "en",
	"repo_mode": "python"
}
```

**Save state** at the end of Phase 1 and Phase 2. Delete `.release-tmp/` (including
state.json) at the end of Phase 3 after everything succeeds.

**On resume:** Use AskUserQuestion:

- "Found incomplete release (issue #N, Phase M). Resume?"
- Options: "Yes, resume from Phase {M+1}", "No, start fresh (will not create a duplicate issue)"

If "start fresh": delete `.release-tmp/state.json`. If the state file contained an
`issue_number`, ask whether to close the orphaned issue before proceeding from Phase 0.

---

## Config File

Read `CONFIG_FILE` at startup if it exists:

```bash
cat .claude/skills/release/config.json 2>/dev/null
```

**Schema:**

```json
{
	"language": "en",
	"repo_mode": "skills-gems",
	"preflight_confirm": false
}
```

| Field                      | Effect when set                                                                 |
| -------------------------- | ------------------------------------------------------------------------------- |
| `language`                 | Skip Step 1.5 — use this language directly                                      |
| `repo_mode`                | Skip detection — use this mode directly; validation still runs                  |
| `preflight_confirm: false` | Skip the confirmation gate — validation runs silently without asking "Proceed?" |

All fields are optional. Missing fields fall back to the interactive flow.

---

## Phase 0: Startup

### 0a: Read Config

Read `CONFIG_FILE` if it exists. Store values for later steps.

### 0b: Check for Resume State

Check if `.release-tmp/state.json` exists. If so, follow the Resume State pattern above.
If resuming, skip to the appropriate phase.

### 0c: Repo Detection

**If `repo_mode` is set in config:** skip detection, use the configured mode.
State: "Using configured mode: `<mode>`."

**Otherwise**, run detection:

```bash
ls package.json pyproject.toml uv.lock skills/ 2>/dev/null
git status --short
```

Classify into one or more modes:

| Signal detected                                                  | Mode            |
| ---------------------------------------------------------------- | --------------- |
| `skills/` directory exists AND changed files are under `skills/` | **skills-gems** |
| `package.json` exists                                            | **npm**         |
| `pyproject.toml` or `uv.lock` exists                             | **python**      |
| Two or more of the above                                         | **monorepo**    |
| None of the above                                                | **generic**     |

**If `preflight_confirm` is `false` in config:** announce mode and proceed.

**Otherwise**, use AskUserQuestion:

> "Detected: **\<mode\>**. Validation will run: \<summary from pattern file\>. Proceed?"

Options:

- "Yes, proceed" (Recommended)
- "Skip validation"
- "Override mode" → follow-up AskUserQuestion: skills-gems / npm / python / monorepo / generic

---

## Phase 1: Context + Planning

### Step 1: Gather Context

From the session, identify:

- What feature/fix was implemented
- Which files were modified
- What the key changes were
- Any breaking changes

### Step 1.5: Ask for Language

**If `language` is set in config:** skip, use the configured language.

Otherwise, use AskUserQuestion:

- "What language should the issue, plan, and release notes be written in?"
- Options: "English", "Japanese (日本語)", "Other" (free text)

**Store the selected language.** Apply it to all generated content. Commit messages
always stay in English (git convention).

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

Strip the `v` prefix to get the current version number. Use AskUserQuestion:

- patch: v{x}.{y}.{z+1}
- minor: v{x}.{y+1}.0
- major: v{x+1}.0.0
- Skip (no tag or release)

Always prefix with "v". **Store the selected version** for later steps.

### Step 5: Create Plan File

Read `SKILLS_DIR/templates/plan.md` for the template and rules.

Create `.plans/<slugified-title>.md` filled with real content from the session.
Write all narrative content in the language selected in Step 1.5. Section headings
may stay in English for template consistency, but all prose must be in the selected language.

### Step 6: Create GitHub Issue

#### 6a: Handle Milestone (if version selected)

```bash
gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title == "<version>") | .title'
```

If missing:

```bash
gh api repos/{owner}/{repo}/milestones -f title="<version>" -f state="open"
```

#### 6b: Create the Issue

Read `SKILLS_DIR/templates/issue-body.md` for the body format.

Follow the **Safe GitHub Body Write** pattern:

1. Write issue body to `.release-tmp/issue-body.md`
2. Create issue with `--body-file .release-tmp/issue-body.md`
3. Verify body is not empty

```bash
gh issue create \
  --title "<title>" \
  --label "<labels>" \
  --assignee "@me" \
  --milestone "<version>" \
  --body-file .release-tmp/issue-body.md
```

Omit `--milestone` if version was skipped.

**Verify:**

```bash
BODY_LEN=$(gh issue view <issue-number> --json body --jq '.body | length')
if [ "$BODY_LEN" -eq 0 ]; then
  echo "ERROR: Issue body is empty!"
  exit 1
fi
echo "Issue body verified ($BODY_LEN chars)"
```

### Step 7: Generate Commit Message

```
feat(<scope>): <description> (#<issue-number>)
```

Use `fix()` for bugs, `docs()` for documentation, `refactor()` for refactoring.

Output: `Issue created: <url> — proceeding with validation...`

### Step 7.5: Save State

Write `.release-tmp/state.json` with all collected values (see Resume State pattern).
Set `"phase": 1`.

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

Read and follow `SKILLS_DIR/patterns/<mode>.md`.

**This is the single validation step** — patterns include the full validation suite
(lint, format, typecheck, tests) for their ecosystem. There is no separate validation
later in the flow.

If validation fails, stop — do not continue until resolved.

### Step 10: Check README and CHANGELOG

Check whether `README.md` and `CHANGELOG.md` need updating based on changes in this release:

**README.md — check for:**

- New skills or commands not yet listed
- Removed or renamed skills/commands still listed
- Installation instructions referencing outdated paths

**CHANGELOG.md — check for:**

- Missing entry for the current version being released

If updates are needed, make them now — they land in the same commit as the code.
If already accurate, state so and continue.

### Step 10.5: Save State

Update `.release-tmp/state.json`. Set `"phase": 2`.

---

## Phase 3: Release

### Step 11: Bump Version

**If user selected "Skip" in Step 4:** skip this step entirely.

**Otherwise:** Follow the "Version Bump" section in `SKILLS_DIR/patterns/<mode>.md`
for ecosystem-specific instructions on where and how to update the version file.

Use the **Edit tool** to update the version — not a Python script or shell one-liner.

Commit the version bump separately:

```bash
git add <version-file>
git commit -m "Bump version to <new-version>"
```

### Step 12: Commit Release Changes & Tag

**IMPORTANT: The release commit must be the LAST commit before push.**
Post-reincarnation verification reads `git log -1` to find the issue number.
The version bump commit (Step 11) comes first, then the release commit with the tag.

```bash
git status --short
```

Use AskUserQuestion:

- "Commit these changes?"
- Show the commit message from Step 7
- Options: "Yes, use this message", "No, use custom message", "Cancel"

```bash
# Stage only release-relevant files shown by git status
git add <specific-files>
git commit -m "<commit-message>"
```

Tag the release commit (if version was selected):

```bash
git tag v<new-version>
```

### Step 13: Push to Remote

Use AskUserQuestion:

- "Push commits and tags to remote?"
- Options: "Yes, push now", "No, I'll push manually", "Cancel"

```bash
git push && git push --tags
```

On failure: show manual command.

### Step 14: Create GitHub Release

**Skip if version was skipped.**

Read `SKILLS_DIR/templates/release-notes.md` for the format.

Follow the **Safe GitHub Body Write** pattern:

1. Write release notes to `.release-tmp/release-notes.md`
2. Create release with `--notes-file .release-tmp/release-notes.md`
3. Verify body is not empty

```bash
gh release create v<version> \
  --title "<version> - <plan-title>" \
  --notes-file .release-tmp/release-notes.md
```

**Verify:**

```bash
BODY_LEN=$(gh release view v<version> --json body --jq '.body | length')
if [ "$BODY_LEN" -eq 0 ]; then
  echo "ERROR: Release body is empty!"
  exit 1
fi
echo "Release body verified ($BODY_LEN chars)"
```

Write release notes in the language selected in Step 1.5.

### Step 15: Close Issue

```bash
gh issue close <issue-number> --comment "Released in v<version>"
```

If version was skipped:

```bash
gh issue close <issue-number> --comment "Shipped in <commit-sha>"
```

### Step 16: Clean Up

```bash
rm -rf .release-tmp
```

Only clean up after both issue and release bodies are verified.

### Step 17: Output Success

**If config did not exist at startup**, use AskUserQuestion:

- "Save these preferences for future runs? (skips detection and language prompts)"
- Options: "Yes, save to config.json", "No, ask me each time"

If yes, write `CONFIG_FILE` with the language and mode used this run, and
`preflight_confirm: false`.

---

**If version was tagged**, output as plain markdown prose (not a fenced code block).
Use markdown link syntax so URLs are clickable in the IDE:

> Release complete!
>
> - **Issue:** `[#N](full-issue-url)`
> - **Version:** old → new
> - **Tag:** `vX.Y.Z`
> - **Release:** `[vX.Y.Z](full-release-url)`

**If version was skipped**, output as plain markdown prose:

> Changes committed and pushed!
>
> - **Issue:** `[#N](full-issue-url)`
> - **Commit:** `commit-message`
>
> No version tag or GitHub release (skipped).

---

## Error Handling

| Scenario           | Action                                             |
| ------------------ | -------------------------------------------------- |
| Remote fetch fails | Warn and continue                                  |
| Pull conflicts     | Stop, instruct to resolve manually                 |
| Validation fails   | Stop, AskUserQuestion: skip or fix                 |
| Commit fails       | Stop (likely pre-commit hook)                      |
| Tag already exists | Stop, AskUserQuestion with next version suggestion |
| Push fails         | Warn, show manual command                          |
| gh not installed   | Warn, provide manual release URL                   |
| Issue body empty   | Stop, do not continue (Safe Body Write pattern)    |
| Release body empty | Stop, do not continue (Safe Body Write pattern)    |
