# Template: Release Notes

Use this format when creating GitHub release notes in Step 14.

Content is derived from the plan file (`.plans/<title>.md`) but restructured for a
**user-facing audience** — what changed, why it matters, and any breaking changes.

---

## Format

```markdown
## What's New

<1-3 paragraph summary of what this release adds or fixes. Focus on user-visible behavior
changes, not implementation details. Written in the language selected in Phase 1.>

## Changes

<Bulleted list of concrete changes. Each bullet names a specific feature, fix, or behavior
change. Group by component if there are 5+ items.>

## Breaking Changes

<List of breaking changes with migration steps, or "None" if no breaking changes.>

---

Plan: [.plans/<filename>.md](.plans/<filename>.md)
Issue: #<issue-number>
```

---

## Rules

- **User-facing language** — write for someone using the project, not maintaining it
- **No file paths or function names** — those belong in the plan, not release notes
- **Changes are behavior-oriented** — "Ruby now routes background tasks to a smaller model" not "Added model routing logic to agent/llm.py"
- **Breaking changes include migration steps** — tell the reader what to do, not just what broke
- Keep it concise — release notes should be scannable in 30 seconds
