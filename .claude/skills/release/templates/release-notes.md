# Template: Release Notes

Use this format when creating GitHub release notes in Step 14.

**The `## Changes` list is the CHANGELOG section promoted in Step 10b, copied verbatim.**
Do not compose an independent summary of the same release — two hand-written summaries of
one release drift, and a reader comparing `CHANGELOG.md` against the GitHub release should
never find them disagreeing. `CHANGELOG.md` is the source of truth; this is its
presentation layer, with a lead-in paragraph and links the CHANGELOG does not carry.

The one-to-three paragraph intro _is_ written fresh — it is the "why this matters" framing
that a changelog entry deliberately omits. Derive it from the plan file
(`.plans/<title>.md`), written for someone **practising with** the app, not maintaining it.

---

## Format

```markdown
## What's New

<1-3 paragraph summary of what this release adds or fixes. Focus on user-visible behavior
changes, not implementation details. Written in the Language from the Fixed Settings table
in SKILL.md.>

## Changes

<The `## [<version>]` section body from CHANGELOG.md, verbatim — its `### Added` /
`### Changed` / etc. subsections and their bullets, with the version heading itself
dropped (the release title already carries the version).>

## Breaking Changes

<List of breaking changes with migration steps, or "None" if no breaking changes.>

---

Plan: [.plans/<filename>.md](https://github.com/oharu121/quiz-practice/blob/main/.plans/<filename>.md)
Issue: #<issue-number>
```

**File links must be absolute `https://github.com/...` URLs.** A release renders at
`/releases/tag/<tag>`, so a relative path resolves against that and 404s — the same trap
as the issue body. `#<issue-number>` is fine as-is; GitHub auto-links issue references.

---

## Rules

- **User-facing language** — write for someone using the project, not maintaining it
- **No file paths or function names** — those belong in the plan, not release notes
- **Changes are behavior-oriented** — "The question list can now be filtered to questions you have not answered yet" not "Added an unanswered branch to filterQuestions"
- **Breaking changes include migration steps** — tell the reader what to do, not just what broke
- Keep it concise — release notes should be scannable in 30 seconds
