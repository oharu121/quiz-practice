# Code Review Checklist

Passed to the review subagent in Step 12.5, together with `git diff main...HEAD` and the
issue body from Step 6b.

Two axes, and they fail differently. **Standards** (Dimensions 1–6, 8) asks whether the
diff is correct on its own terms; **Spec** (Dimension 7) asks whether it is the change
that was asked for. A diff can be flawless and still not do what the issue promised, so a
clean Standards pass is not evidence for Spec.

## Scope

This is a **SvelteKit 2 / Svelte 5 single-page app** — TypeScript, runes everywhere,
`@sveltejs/adapter-static` with `fallback: 'index.html'`, `ssr = false` and
`prerender = false` in `src/routes/+layout.ts`. Everything runs in the browser. There is no
backend, no server route, no API, and no database: all state lives in `localStorage` and
all 420 questions ship in the bundle.

Review the diff only. Do not report on unchanged code.

## What NOT to report

The tooling already catches these. Reporting them wastes the reader's attention:

- **Type errors** — `pnpm check` runs `svelte-check` over `src/**` and `vite.config.ts`.
- **Lint violations** — `pnpm lint` runs ESLint with `typescript-eslint` and
  `eslint-plugin-svelte` recommended sets. Unused locals and unused imports land here.
- **Formatting** — `pnpm format:check` runs Prettier.

Note the one gap worth knowing: `svelte-check` does **not** cover `scripts/`, because
`.svelte-kit/tsconfig.json`'s include list stops at `src/**`, `vite.config.ts` and
`test/**`. A change under `scripts/` is linted and formatted but never type-checked, so
type-level mistakes there are fair game for this review.

Also skip: style preferences, naming bikeshedding, and "consider extracting this"
suggestions. Report defects, not opinions.

## Dimensions

### 1. Svelte 5 runes correctness

The compiler runs in runes mode for everything outside `node_modules`
([vite.config.ts](../../../vite.config.ts)), so the legacy reactivity escape hatches are
not available and misuse fails at runtime rather than at build.

- Runes used in a plain `.ts` file. Runes outside a component only work in a `.svelte.ts`
  module — `state.svelte.ts` and `quiz-engine.svelte.ts` are named that way for this
  reason. A rune added to `utils.ts` or `backup.ts` is a defect.
- `$effect` used where `$derived` would do. An effect that only computes a value from
  other state is a reactivity bug waiting to happen: it runs a tick late, and readers see
  the stale value in between.
- An `$effect` that writes state it also reads, producing a loop.
- `$effect` created outside a component lifecycle without `$effect.root`. The
  persistence effect in `QuizStateManager`'s constructor is wrapped for exactly this
  reason — an unwrapped one throws `effect_orphan`.
- Reassigning a `$derived` value, or mutating the array a `$derived` returned.
- Props read without `$props()`, or a prop destructured in a way that drops reactivity.

### 2. Persisted state and backup integrity

`localStorage` under the `aws_quiz_state` key is the only durable store, and
[src/lib/backup.ts](../../../src/lib/backup.ts) is the import/export path in and out of it.
A mistake here silently destroys a user's practice history, and there is no server copy.

- A change to the shape of `QuizState`, `QuestionHistory`, or the `BackupFile` envelope
  without a matching bump or migration. `BACKUP_VERSION` exists so an old export can be
  recognised; a shape change that leaves it at `1` makes old and new files
  indistinguishable.
- `parseProgress` accepting a shape it should reject, or `BackupParseError` swallowed by a
  bare `catch` at the call site so a corrupt import reads as an empty one.
- `mergeProgress` losing entries, or resolving a conflict differently from what
  `summarizeImport` told the user was about to happen. Those two must agree — the summary
  is the consent.
- A write path that replaces the whole state object where it meant to update one field.
- Direct `localStorage` access added outside `state.svelte.ts` without the
  `typeof localStorage === 'undefined'` guard. Vitest runs these modules in Node, so an
  unguarded access breaks the test suite rather than the app.

### 3. Question data and quiz logic

[src/lib/data/questions.json](../../../src/lib/data/questions.json) is 420 entries typed by
`Question` in `src/lib/types.ts`. Nothing validates it at build time — `resolveJsonModule`
gives it a structural type, not a checked one — so this dimension is the only guard.

- A question whose `correct_index` does not point at `correct_answer` in `choices`. The
  two are redundant by design and nothing cross-checks them.
- A multi-answer question (`correct_answer` and `correct_index` as arrays) where
  `isMultiAnswer` or `getRequiredSelections` would report the single-answer result, or the
  reverse. `checkAnswer` takes `number[]` either way; the branch is in the callers.
- A `category` value outside the `Category` union — six literals, `CLF_`/`AIF_` ×
  `Beginner`/`Theme`/`Multi`. A new one needs `CATEGORY_LABELS` updated too, or the badge
  renders `undefined`.
- A new `FilterMode` added to the union without an entry in `FILTER_LABELS`, or without a
  branch in `filterQuestions` — the filter then silently returns everything.
- `shuffle` applied to an array that is also the source of truth for an index. Shuffling
  `choices` without remapping `correct_index` marks correct answers wrong.

### 4. Accessibility and mobile interaction

This is a phone-first app: a bottom nav, swipe gestures, and large tap targets.

- A choice, bookmark, or nav control that is a `<div>` with an `on:click` rather than a
  `<button>` — not reachable by keyboard and unannounced to a screen reader.
- An interactive element with no accessible name (icon-only buttons in `BottomNav`,
  `BookmarkButton`).
- A swipe binding from `actions/swipeable.ts` that is the _only_ way to reach a behaviour.
  Every gesture needs a visible control that does the same thing.
- Answer correctness signalled by colour alone, with no text or icon alongside it.
- Focus lost after a state change — answering a question, navigating, resetting progress —
  leaving the keyboard user at the top of the document.
- Headings skipped for visual reasons (`h2` → `h4`).

### 5. Dead code

- Exports in `src/lib/` (`utils.ts`, `backup.ts`, `types.ts`) that nothing imports.
- Components in `src/lib/components/` imported nowhere.
- ESLint catches unused _locals_, not unused _exports_, and the repo has no `knip` — so
  this pass is the only signal for module-level dead code.
- This is a reachability check — is anything importing it at all — distinct from
  Dimension 8's Speculative Generality/Middle Man, which are about a _called_ export that
  should not exist in its current shape. Unreachable goes here; reachable-but-wrong goes
  there.

### 6. Secrets and leakage

- Tokens, API keys, or credentials in committed files. There is no backend and no `.env`
  in use, so anything that looks like a credential is almost certainly a mistake.
- Absolute local paths (`/Users/...`) baked into source or config.
- A change that commits `build/`, `.svelte-kit/` or `.vercel/` — all gitignored, all large.

### 7. Spec conformance

The other six dimensions read the diff alone. This one reads the diff **against the
Acceptance Criteria** in the issue body, which is the only place they exist — the plan
file does not carry them.

Take each `AC-<n>` in turn and decide which of three it is:

- **Met** — name the file and line in the diff that satisfies it. A criterion you cannot
  point at is not met, it is unverified.
- **Unmet** — nothing in the diff implements it. 🔴, regardless of how small the gap
  looks. The AC table is what the PR body and the closing comment claim was delivered, so
  an unmet criterion ships as a false claim in two places.
- **Unverifiable from the diff** — the criterion is about rendered output or behaviour in
  a real browser, which is most of this app. Say so and name what would settle it; do not
  guess. Step 13 is where these land, against the PR's Vercel preview or a local
  `pnpm build && pnpm preview`.

Then look the other way, at diff-not-in-AC: **changes no criterion asked for.** A drive-by
refactor, a renamed export, a tweaked style that rode along with the real fix. 🟡 — not
because it is wrong, but because it is unreviewed by the issue and invisible to anyone
reading the AC table later.

**If no Acceptance Criteria were passed, skip this dimension and say so.** Do not infer
criteria from the diff, the plan, or the issue title — a spec reconstructed from the
implementation agrees with it by construction and tests nothing.

### 8. Code smells

Smell baseline adapted from mattpocock-skills' `code-review` skill
(`skills/engineering/code-review/SKILL.md`). Two rules bind it, unchanged from the
source:

- **The repo overrides.** A documented repo standard always wins; where it endorses
  something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature
  Envy"), never a hard violation. Skip anything tooling already enforces.

Match the diff against each smell — what it is, how to fix it:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it
  does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the
  change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own.
  → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type
  wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that
  deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across
  the change. → replace with polymorphism, or one map both sites share. `FilterMode` and
  `Category` are the two types most likely to sprout these.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in
  the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. →
  split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec
  doesn't have. → delete it; inline back until a real need shows. See Dimension 5 for
  the boundary between this and dead code.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. →
  hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call
  the real target direct. Still called, so it is Dimension 5's opposite: unnecessary
  indirection, not unreachable code.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what
  it inherits. → drop the inheritance, use composition. Rare here — Svelte components and
  `src/lib/` favour composition already — but keep it in the pass.

Same discipline as every other dimension: diff-scoped, real instances only. Skip a
smell already covered by "What NOT to report" above.

## Output Format

Report as `path/to/file.svelte:42 — description`, grouped by severity:

```markdown
## Code Review

### 🔴 High (must fix)

- `src/lib/state.svelte.ts:31` — <what is broken and what it causes>

### 🟡 Medium (recommended)

- `src/lib/utils.ts:33` — <description>

### 🟢 Low (optional)

- `src/lib/components/FilterBar.svelte:12` — <description>
```

Dimension 7 findings usually have no single line to blame, so anchor them to the criterion
instead: `AC-2 — <what is missing>`. Precede the severity groups with the coverage table,
which is reported **every run**, pass or fail — an AC nobody looked at and an AC that
passed are indistinguishable otherwise:

```markdown
### Spec conformance

| AC   | Verdict      | Evidence                         |
| ---- | ------------ | -------------------------------- |
| AC-1 | Met          | `src/lib/utils.ts:12`            |
| AC-2 | Unmet        | nothing in the diff addresses it |
| AC-3 | Unverifiable | needs the running app, Step 13   |
```

If nothing is found:

```
✓ Code review passed. No significant issues found.
```

The spec table still prints above that line. "Nothing found" covers defects, not coverage.

Severity means impact, not effort. Lost practice history is 🔴 even if the fix is one line.
An unused export is 🟢 even if it is a whole file.
