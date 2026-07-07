# Validation Pattern: npm

**Summary for Phase 0 announcement:** lint, format check, and test via npm scripts.

## Validation Steps

This is the **full validation suite** — it runs once during Phase 2. There is no
separate validation later in the flow.

```bash
npm run lint 2>&1
npm run format:check 2>&1
npm test 2>&1
```

If the repo has no `lint` script in `package.json`, skip the lint step and note it.
If the repo has no `format:check` script in `package.json`, skip the format step and note it.
If the repo has no `test` script in `package.json`, skip the test step and note it.

## On Failure

Use AskUserQuestion:

- "Validation failed. How do you want to proceed?"
- Options: "Fix first (cancel release)", "Skip validation and continue"

Show the failing output before asking.

## On Pass

State: "npm validation passed (lint, format, tests)." and continue.

---

## Version Bump

When Step 11 (Bump Version) runs for an npm repo:

```bash
npm version <patch|minor|major> --no-git-tag-version
```

This updates `package.json` (and `package-lock.json` if present) without creating a
git tag — tagging is handled separately in Step 12.

### Drift Check

Before bumping, verify the file version matches the latest git tag:

```bash
FILE_VER=$(node -p "require('./package.json').version")
TAG_VER=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')
if [ "$FILE_VER" != "$TAG_VER" ]; then
  echo "WARNING: package.json ($FILE_VER) != latest tag ($TAG_VER)"
fi
```

If they differ, warn the user and ask which to use as the base for the bump.
