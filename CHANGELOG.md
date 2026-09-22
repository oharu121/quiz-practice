# Changelog

All notable changes to this app are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Question-bank edits are not listed here.** Adding, correcting or retranslating
individual questions in `src/lib/data/questions.json` is routine content work; this file
tracks the app itself — quiz behaviour, storage, layout, tooling and deployment. A change
to the _shape_ of a question (a new field, a new category) does belong here, because that
is a schema change, not content.

## [Unreleased]

## [0.3.0] - 2026-09-22

### Added

- Offline study. A service worker precaches the whole app, so the question bank, the quiz
  and the review list all work with no network — including opening `/quiz` or `/review`
  directly by URL, which previously needed the server.
- Installation to a home screen as a standalone web app, through a web app manifest and a
  purpose-drawn icon set replacing the stock framework logo.
- A Settings tab, holding offline status, backup, restore and progress reset.
- Backup and restore of stored progress, as a downloaded file or through the clipboard.
  Restoring merges rather than overwriting: a question answered more times wins, ties go to
  the more recent attempt, and bookmarks combine — so restoring an older backup cannot roll
  back work done since it was taken, and importing the same backup twice changes nothing.
  The confirmation dialog counts exactly what the restore will change, so nothing is
  replaced without being named first.
- Keyboard and screen-reader support for the new Settings surface: both confirmation
  dialogs take focus, close on Escape and return focus afterwards, and every control is
  reachable by tab.
- A CI workflow running the same five checks the release gate does, on pull requests and on
  pushes to `main`.
- `README.md` and this changelog.

### Changed

- Progress reset moved from the question list to the Settings tab, grouping the actions
  that discard or replace stored data in one place.
- The release skill was rewritten as a single repo-specific flow, dropping `config.json`
  and the four generic `patterns/*.md` files, and gained a guard script for the checks that
  need to fail a release rather than warn.
- Prettier no longer checks `.claude/settings.local.json`, which the editor rewrites with
  its own formatting and which was failing the format gate on a file nobody edits by hand.

## [0.2.0] - 2026-09-20

### Added

- An "unanswered" filter on the question list, so a session can resume on the questions
  you have not reached yet instead of scrolling past the ones you have.
- A reset-progress action that clears stored answers and starts the bank over.
- ESLint, Prettier and Vitest, with the lint failures they found fixed.

## [0.1.0] - 2026-09-19

### Added

- Initial release: an AWS certification quiz practice single-page app built with SvelteKit
  and `adapter-static`, carrying 420 translated questions.
- Bookmarks, category badges, a progress bar and a review mode, with answers and bookmarks
  persisted to `localStorage`.
- Vercel deployment as a static SPA, with framework detection disabled and a catch-all
  rewrite so client-side routes survive a page reload.

[unreleased]: https://github.com/oharu121/quiz-practice/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/oharu121/quiz-practice/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/oharu121/quiz-practice/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/oharu121/quiz-practice/releases/tag/v0.1.0
