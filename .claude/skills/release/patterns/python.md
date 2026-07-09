# Validation Pattern: python

**Summary for Phase 0 announcement:** lint (ruff), format check (ruff), typecheck (pyright), and tests (pytest).

## Validation Steps

This is the **full validation suite** — it runs once during Phase 2. There is no
separate validation later in the flow.

Detect whether the project uses `uv`:

```bash
if [ -f uv.lock ]; then
  RUNNER="uv run"
else
  RUNNER="python -m"
fi
```

Run all checks:

```bash
$RUNNER ruff check . 2>&1
$RUNNER ruff format --check . 2>&1
$RUNNER pyright . 2>&1
$RUNNER pytest 2>&1
```

If `ruff` is not installed/configured, skip lint and note it.
If no test files are found, skip pytest and note it.

## On Failure

Use AskUserQuestion:

- "Validation failed. How do you want to proceed?"
- Options: "Fix first (cancel release)", "Skip validation and continue"

Show the failing output before asking.

## On Pass

State: "Python validation passed (lint, format, typecheck, tests)." and continue.

---

## Version Bump

When Step 11 (Bump Version) runs for a python repo:

1. Read `pyproject.toml` to find the current `version = "X.Y.Z"` line
2. Calculate the new version based on the selected version type (patch/minor/major)
3. Use the **Edit tool** to replace the version string — do NOT use a Python script
4. Verify the file version matches the new tag:
   ```bash
   grep '^version' pyproject.toml
   ```

**Example:** To bump from `0.29.0` to `0.30.0`, use the Edit tool to change
`version = "0.29.0"` to `version = "0.30.0"` in `pyproject.toml`.

### Drift Check

Before bumping, verify the file version matches the latest git tag:

```bash
FILE_VER=$(grep -oP 'version\s*=\s*"?\K[^"]+' pyproject.toml | head -1)
TAG_VER=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')
if [ "$FILE_VER" != "$TAG_VER" ]; then
  echo "WARNING: pyproject.toml ($FILE_VER) != latest tag ($TAG_VER)"
fi
```

If they differ, warn the user and ask which to use as the base for the bump.
