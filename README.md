# AWS Quiz Practice

A single-page quiz app for practising AWS certification questions — Cloud Practitioner
(CLF) and AI Practitioner (AIF). It is fully static: every question ships in the bundle and
all progress lives in the browser, so there is no account, no backend and no network call
after the first load.

Deployed on Vercel from `main`, through Vercel's own Git integration.

## What it does

- **420 questions** across six categories (`CLF_Beginner`, `CLF_Theme`, `CLF_Multi`, and
  the three `AIF_` equivalents), each with choices, the correct answer and a written
  explanation.
- **Filters** — all, CLF only, AIF only, bookmarked, previously incorrect, or unanswered.
- **Per-question history** — attempts, correct count, last result and last seen, used by
  the incorrect and unanswered filters.
- **Bookmarks** and a **review mode** for working through them.
- **Offline study** — a service worker precaches the whole app, so every question and every
  route works with no network once the app has been loaded once.
- **Installable** to a home screen as a standalone web app, via the web app manifest.
- **Backup and restore** of progress, as a file or through the clipboard. Browsers and
  installed web apps keep separate storage, and there is no backend to sync through, so
  moving progress between them is an explicit export and import.
- **Progress reset**, for starting the bank over.

Offline status, backup, restore and reset all live on the **Settings** tab.

## Stack

| Piece     | Choice                                                                                |
| --------- | ------------------------------------------------------------------------------------- |
| Framework | SvelteKit 2 with Svelte 5 runes (`runes: true` for everything outside `node_modules`) |
| Build     | Vite 8                                                                                |
| Adapter   | `@sveltejs/adapter-static` with `fallback: 'index.html'` — a true SPA                 |
| Language  | TypeScript, checked by `svelte-check`                                                 |
| Tests     | Vitest                                                                                |
| Deploy    | Vercel, static output from `build/`                                                   |

There is no `svelte.config.js`. SvelteKit is configured inline through the `sveltekit()`
plugin options in [vite.config.ts](vite.config.ts), which keeps the adapter and the compiler
options in one place.

## Layout

```
src/
  routes/          +page (question list), quiz/, review/, settings/
  lib/
    data/questions.json    the 420-question bank
    types.ts               Question, QuestionHistory, QuizState, FilterMode
    state.svelte.ts        persisted state (bookmarks + history)
    quiz-engine.svelte.ts  question selection and answer checking
    backup.ts              export/import of stored progress
    components/            QuestionCard, ChoiceButton, FilterBar, …
    actions/swipeable.ts   swipe gestures
  service-worker.ts        offline caching
scripts/
  generate-icons.mjs       PWA icon generation from the source SVG
  release-guard.mjs        release-flow guards (see .claude/skills/release/)
static/                    manifest, icons, favicon
```

## Commands

```bash
pnpm install        # npm and npx are blocked on this machine — pnpm only
pnpm dev            # dev server
pnpm check          # svelte-kit sync && svelte-check
pnpm lint           # eslint .
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
pnpm test           # vitest run
pnpm build          # static build into build/
pnpm preview        # serve the built output
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `check`, `lint`,
`format:check`, `test` and `build` on every pull request and on pushes to `main`.

## Releasing

Releases go through the `/release` skill in
[.claude/skills/release/](.claude/skills/release/): it opens an issue, cuts a branch, runs
validation, reviews the diff, opens and merges a PR, then tags `main` and publishes a
GitHub release. Version history is in [CHANGELOG.md](CHANGELOG.md).

## Question data

`src/lib/data/questions.json` is the shipped bank; `keepitup_questions.json` and
`keepitup_questions_en.json` at the repo root are the upstream source dumps it was derived
from. Both are excluded from Prettier — they are generated data, not hand-maintained.
