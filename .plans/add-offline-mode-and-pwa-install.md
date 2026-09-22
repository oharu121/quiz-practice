# Plan: Add offline mode and PWA install

**Status:** Completed
**Date:** 2026-09-22

## Context

The app is studied on a phone, including on flights. Until now it was a static SvelteKit
SPA on Vercel with no service worker, so with no network the URL simply failed to load —
the one situation where an offline question bank would be most useful was the one situation
it could not serve.

The original request came with two assumptions, and exploring the code contradicted both.

The first was that offline storage should hold only the unanswered, incorrect and
bookmarked questions, to save space. But
[questions.json](https://github.com/oharu121/quiz-practice/blob/main/src/lib/data/questions.json)
is a _static import_ in the browse and review routes, so Vite inlines all 420 questions
into a single JS chunk at build time. Every visitor already downloads the whole bank on
first load, and the entire production build is 936 KB. A per-user subset would save nothing
offline, cannot be computed at build time, and would break the existing `bookmarked`,
`incorrect` and `unanswered` filters the moment a question fell outside the cached set.
That idea already exists in the app, and better, as the filter bar.

The second was that adding a service worker might wipe stored progress. It does not —
progress lives in `localStorage['aws_quiz_state']` on the same origin, which a service
worker never touches. The real threat was elsewhere and considerably worse. Every iOS
browser is a WebKit shell, and WebKit grants the Service Worker API only to Safari,
`SFSafariViewController` and Home Screen web apps. On top of that, a Home Screen web app
gets its own storage jar, separate from the browser that installed it. So the act of
installing the app — the thing that makes offline work at all on iOS — presents an empty
history, and progress built up in a browser tab does not follow it across.

That is a data-migration problem wearing a caching problem's clothes, and it is why this
release ships backup and restore as its own stage, to be deployed and used before the
service worker ever appears.

## Approach

**Precache everything.** The whole build is under 1 MB and the question bank is already in
the bundle, so the service worker caches all of it. No subset logic, no cache-eviction
policy, no way for a filter to point at a question that is not there.

**One cache, not one per deploy.** The first draft named the cache `aws-quiz-${version}`,
which is the conventional shape. It is wrong here. The worker deliberately does not call
`skipWaiting()`, so it only activates once every client closes — on an installed iOS web
app, potentially weeks. Cleanup lives in `activate`, so every deploy in between would
strand a fresh ~950 KB cache. A stable name lets `install` add the new deploy's assets
alongside the old ones and `activate` prune whatever is no longer referenced.

**Freshness comes from the fetch strategy, not the lifecycle.** Content-hashed build output
is served cache-first, because a hit is always the right answer by construction. Everything
else — navigations included — is network-first with a cache fallback. This is what makes a
new deploy land on the next reload without `skipWaiting()`, and it is also what keeps a
running quiz from being swapped out underneath itself.

**Backup is a transfer mechanism, not a sync feature.** There is no server and no account,
so the honest design is an explicit export and import the user drives: copy to clipboard or
download a file, paste or pick it on the other side. The merge rule is "never lose work",
so restoring a stale backup cannot roll back questions answered since it was taken.

Alongside the app work, this release also lands a rewritten release skill and the CI
workflow and guard script it depends on, which were developed in parallel.

## Changes

### 1. Backup and restore

[`src/lib/backup.ts`](https://github.com/oharu121/quiz-practice/blob/main/src/lib/backup.ts)
holds pure functions with no Svelte runes, so they are testable without a DOM:

- `serializeProgress` wraps the exact stored `QuizState` as
  `{ version: 1, exportedAt, state }`. The on-disk shape matches the in-storage shape
  deliberately — a backup file can be compared against `localStorage` by eye.
- `parseProgress` validates the version, that `bookmarks` is a `string[]`, and that every
  history entry carries `attempts`, `correct`, `last_result` and `last_seen`. It throws
  `BackupParseError` with a readable message rather than coercing, so a bad paste fails
  visibly instead of being applied halfway.
- `mergeProgress` resolves per question ID: more `attempts` wins, and an attempts tie goes
  to the later `last_seen`. Entries are kept whole rather than summed, which makes
  re-importing the same backup a no-op. Bookmarks union, because a resurrected bookmark
  costs a tap and a lost one costs a question you meant to revisit.
- `summarizeImport` reports what an import would change, so the confirmation dialog can
  name numbers instead of asking for blind trust.

[`state.svelte.ts`](https://github.com/oharu121/quiz-practice/blob/main/src/lib/state.svelte.ts)
gains `exportProgress`, `previewImport` and `importProgress` beside the existing
`resetProgress`. `importProgress` assigns fresh containers so the persisting `$effect`
re-runs.

### 2. Settings route

New [`/settings`](https://github.com/oharu121/quiz-practice/blob/main/src/routes/settings/+page.svelte)
with four cards: offline status, backup, restore, reset. Backup offers clipboard copy and a
`.json` download; restore accepts a paste or a file and shows a preview modal before
applying. The offline card reads `navigator.serviceWorker.controller` and a `__sw-version`
entry the worker writes into its cache, so it reports whether this browser is actually
running the worker rather than asserting which browsers do.

Reset moved here from the browse page, consolidating the destructive actions in one place.
`BottomNav` gains a fourth item; the nav is a flex row of equal children, so no layout
change was needed.

### 3. Service worker

[`src/service-worker.ts`](https://github.com/oharu121/quiz-practice/blob/main/src/service-worker.ts),
auto-registered by SvelteKit. `install` precaches `build`, `files` and the shell; `activate`
drops foreign caches and prunes unreferenced entries. Neither `skipWaiting()` nor
`clients.claim()` is called, so a deploy cannot replace a running session.

Navigations are network-first with the cached shell as fallback. `adapter-static` runs with
`fallback: 'index.html'`, so `prerendered` is empty and there is no per-route HTML — the
shell is the only document, and this fallback is what makes `/quiz` and `/review` resolve
offline. `/_app/version.json` is passed through uncached so SvelteKit's redeploy detection
is never pinned to a stale value.

### 4. Manifest and icons

[`manifest.webmanifest`](https://github.com/oharu121/quiz-practice/blob/main/static/manifest.webmanifest)
declares `display: standalone` with the existing `#232f3e` theme colour. The stock Svelte
logo was replaced by a purpose-drawn mark — an AWS-orange question glyph on navy, full
bleed, glyph inside the central 80% so Android's maskable crop cannot clip it.
[`scripts/generate-icons.mjs`](https://github.com/oharu121/quiz-practice/blob/main/scripts/generate-icons.mjs)
rasterises it to 192, 512, 512-maskable and a 180 px `apple-touch-icon`. It is run by hand
and its output is committed, so `pnpm build` stays free of `sharp`.

### 5. Release infrastructure

The release skill was rewritten around inlined fixed settings, replacing `config.json` and
the four `patterns/*.md` files with a single repo-specific flow. Its `allowed-tools`
frontmatter now pre-approves the exact command shapes the flow uses, so a release runs
without permission prompts. [`scripts/release-guard.mjs`](https://github.com/oharu121/quiz-practice/blob/main/scripts/release-guard.mjs)
provides the `body-check`, `push-guard`, `tag-guard` and `branch-cleanup` guards that need
a real non-zero exit, and
[`.github/workflows/ci.yml`](https://github.com/oharu121/quiz-practice/blob/main/.github/workflows/ci.yml)
runs the same five commands the release gate does. `README.md` and `CHANGELOG.md` are new.
`.prettierignore` now excludes `.claude/settings.local.json`, which the tool rewrites with
its own formatting and which was failing `pnpm format:check` on a file nobody edits by hand.

## Files Modified

| File                                                                                                                           | Change                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [src/lib/backup.ts](https://github.com/oharu121/quiz-practice/blob/main/src/lib/backup.ts)                                     | New — serialize, parse, merge and summarize progress backups                  |
| [src/lib/backup.test.ts](https://github.com/oharu121/quiz-practice/blob/main/src/lib/backup.test.ts)                           | New — 18 unit tests covering round-trip, rejections and every merge rule      |
| [src/lib/state.svelte.ts](https://github.com/oharu121/quiz-practice/blob/main/src/lib/state.svelte.ts)                         | Added `exportProgress`, `previewImport`, `importProgress`, `snapshot`         |
| [src/routes/settings/+page.svelte](https://github.com/oharu121/quiz-practice/blob/main/src/routes/settings/+page.svelte)       | New — offline status, backup, restore, reset                                  |
| [src/lib/components/BottomNav.svelte](https://github.com/oharu121/quiz-practice/blob/main/src/lib/components/BottomNav.svelte) | Fourth nav item for Settings                                                  |
| [src/routes/+page.svelte](https://github.com/oharu121/quiz-practice/blob/main/src/routes/+page.svelte)                         | Reset button and modal moved to Settings; empty-state copy points there       |
| [src/service-worker.ts](https://github.com/oharu121/quiz-practice/blob/main/src/service-worker.ts)                             | New — precache, prune, cache-first hashed assets, network-first navigations   |
| [src/app.html](https://github.com/oharu121/quiz-practice/blob/main/src/app.html)                                               | Manifest, favicon, apple-touch-icon and iOS web-app meta tags                 |
| [static/manifest.webmanifest](https://github.com/oharu121/quiz-practice/blob/main/static/manifest.webmanifest)                 | New — standalone display, icon set, theme colour                              |
| [static/favicon.svg](https://github.com/oharu121/quiz-practice/blob/main/static/favicon.svg)                                   | New app mark; the stock Svelte logo in `src/lib/assets/` was deleted          |
| [scripts/generate-icons.mjs](https://github.com/oharu121/quiz-practice/blob/main/scripts/generate-icons.mjs)                   | New — one-off rasteriser, output committed                                    |
| [scripts/release-guard.mjs](https://github.com/oharu121/quiz-practice/blob/main/scripts/release-guard.mjs)                     | New — `body-check`, `push-guard`, `tag-guard`, `branch-cleanup`               |
| [.github/workflows/ci.yml](https://github.com/oharu121/quiz-practice/blob/main/.github/workflows/ci.yml)                       | New — runs the same five checks as the release gate                           |
| [.claude/skills/release/](https://github.com/oharu121/quiz-practice/blob/main/.claude/skills/release/)                         | Rewritten; `config.json` and `patterns/` removed, `review-checklist.md` added |
| [README.md](https://github.com/oharu121/quiz-practice/blob/main/README.md)                                                     | New                                                                           |
| [CHANGELOG.md](https://github.com/oharu121/quiz-practice/blob/main/CHANGELOG.md)                                               | New                                                                           |
| [.prettierignore](https://github.com/oharu121/quiz-practice/blob/main/.prettierignore)                                         | Ignore `.claude/settings.local.json`                                          |
| [package.json](https://github.com/oharu121/quiz-practice/blob/main/package.json)                                               | `sharp` devDependency; version bumped to 0.3.0                                |

## Guard Rails

| Scenario                                                 | Behavior                                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A new deploy lands while a quiz is open                  | Nothing changes. No `skipWaiting()`/`clients.claim()`, so the session keeps the worker it started with                |
| The page is reloaded while online after a deploy         | Navigation is network-first, so the new shell and its chunks load immediately — no waiting for the worker to activate |
| A deep link like `/review` is opened offline             | The cached shell answers the navigation and the client router resolves the route                                      |
| A deep link 404s because a host has no SPA rewrite       | Non-OK navigation responses also fall back to the cached shell, so the route still renders                            |
| A malformed or truncated backup is pasted                | `parseProgress` throws `BackupParseError`, the message is shown, and stored progress is untouched                     |
| The same backup is imported twice                        | Idempotent. Entries are replaced whole, never summed                                                                  |
| An old backup is restored onto a device studied on since | Local entries with more attempts win, so nothing is rolled back                                                       |
| Clipboard access is blocked by the browser               | The copy button reports it and points at the download button, which needs no permission                               |
| The browser does not run service workers                 | The settings card says so plainly instead of claiming the app is offline-ready                                        |
| `localStorage` is unavailable or throws                  | Unchanged from before: load falls back to empty state, save is a no-op                                                |

## Verification

Unit and static checks:

```bash
pnpm test          # 38 tests, incl. 8 covering every mergeProgress rule
pnpm check         # 0 errors
pnpm lint
pnpm format:check
pnpm build
```

Offline behaviour was verified in headless Chromium against a real service worker, serving
`build/` from a non-caching static server. Note that `pnpm preview` caches `index.html` in
memory at startup, which silently defeats any redeploy test:

```bash
pnpm build
cd build && python3 -m http.server 4174
```

With that running, confirm by hand or by script:

1. Load `/`, reload once so the worker takes control, and check
   Application → Cache Storage holds `aws-quiz-v1` including the ~760 KB question chunk.
2. Go offline, then open `/quiz` and `/review` **by URL** — this is the navigation-fallback
   path and the one most likely to break.
3. Answer a question offline, reload, and confirm it persisted.
4. Rebuild with a visible string changed, reload online, and confirm the new text appears
   while only one `aws-quiz-*` cache exists.
5. In one browser profile, answer a question and copy the backup from `/settings`. In a
   second, empty profile, paste it, confirm the preview counts, and restore. The summary
   line must match the first profile.

On the phone, after deploying: open `/settings` and read the offline card. It reports
whether this browser is running the service worker, which is the fact that decides whether
offline works in a tab or needs the Home Screen icon.

## Breaking Changes

None. The `localStorage` key `aws_quiz_state` and the `QuizState` shape are unchanged, so
existing progress loads as-is. The reset action moved from the browse page to `/settings`.
