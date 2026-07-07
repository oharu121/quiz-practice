# Validation Pattern: monorepo

**Summary for Phase 0 announcement:** per-package validation for each changed package.

## Validation Steps

### 1. Identify changed packages

```bash
git diff --name-only HEAD
git status --short
```

Group changed files by their top-level package directory (e.g. `packages/api/`, `apps/web/`).

### 2. Run validation per changed package

For each changed package directory, detect its type and run the matching pattern:

| Package signal                        | Pattern to follow   |
| ------------------------------------- | ------------------- |
| `package.json` present                | npm pattern         |
| `pyproject.toml` or `uv.lock` present | python pattern      |
| `skills/` directory present           | skills-gems pattern |

Read and follow the appropriate `SKILLS_DIR/patterns/<type>.md` for each package.
Each sub-pattern runs its **full validation suite** — no separate validation later.

### 3. Report results

Report pass/fail per package before continuing. Example:

```
Validation results:
  packages/api      → npm lint ✓, tests ✓
  packages/worker   → python lint ✓, format ✓, typecheck ✓, tests ✓
  skills/my-skill   → audit ✓
```

## On Any Failure

Use AskUserQuestion:

- "Validation failed in \<package\>. How do you want to proceed?"
- Options: "Fix first (cancel release)", "Skip failed package and continue", "Skip all validation"

## On Full Pass

State: "All package validations passed." and continue.

---

## Version Bump

When Step 11 (Bump Version) runs for a monorepo:

Detect the root version management strategy:

- If root `package.json` has a `version` field → use npm pattern for root
- If root `pyproject.toml` exists → use python pattern for root
- If neither → tags only (no file-based version bump)

For per-package versioning (e.g. Lerna, Turborepo), delegate to the appropriate
ecosystem pattern for each package that was modified.
