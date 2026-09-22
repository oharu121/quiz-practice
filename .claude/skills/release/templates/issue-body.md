# Template: Issue Body

Use this format when creating the GitHub issue in Step 6b.

**IMPORTANT:** Include the COMPLETE plan file content, not a summary.

---

## Format

```markdown
<Full content of .plans/<filename>.md — copy verbatim>

---

## Acceptance Criteria

### AC-1: <First criterion name>

| Criteria | Description                         |
| -------- | ----------------------------------- |
| Given    | <precondition>                      |
| When     | <action>                            |
| Then     | <expected result>                   |
| Verify   | <see Verify field guidelines below> |
| Evidence |                                     |

### AC-2: <Second criterion name>

| Criteria | Description                         |
| -------- | ----------------------------------- |
| Given    | <precondition>                      |
| When     | <action>                            |
| Then     | <expected result>                   |
| Verify   | <see Verify field guidelines below> |
| Evidence |                                     |

---

Plan file: [.plans/<filename>.md](https://github.com/oharu121/quiz-practice/blob/main/.plans/<filename>.md)
```

---

## Link Rule — absolute URLs only

**Every file link in the issue body must be an absolute `https://github.com/...` URL.**

A GitHub issue renders at `/issues/<n>`, so a relative link like `(.plans/foo.md)`
resolves against that path and 404s. This applies to the plan content copied in above as
well as the line at the bottom — the plan file's own "Files Modified" table is the usual
casualty, since it is written with repo-relative paths that work fine in the editor and
break the moment they are embedded here.

Get the base once and build links from it:

```bash
gh repo view --json url -q .url    # -> https://github.com/oharu121/quiz-practice
```

Then: `[path/to/file.ts](https://github.com/oharu121/quiz-practice/blob/main/path/to/file.ts)`

Use `blob/main`, not a commit SHA — the link should follow the file, and the branch this
release is on will not exist after the squash merge.

---

## Verify Field Guidelines

| Value              | When to use                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `auto — <command>` | A shell command can verify this (e.g. `auto — grep -r "pattern" src/`) |
| `auto`             | Determinable from Given/When/Then without a specific command           |
| `manual`           | Requires human eyes — UI behaviour, subjective output, visual checks   |

## AC Rules

- Write 2–4 ACs per issue — one per meaningful behaviour, not one per file changed
- Each AC should be independently verifiable
- "Evidence" is left blank — filled in when the issue is closed
