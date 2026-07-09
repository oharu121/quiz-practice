# Plan: Add unanswered filter and reset progress

**Status:** Completed
**Date:** 2026-07-09

## Context

Users practicing AWS certification questions had no way to skip questions they'd already answered. Every time they opened the app, they'd see all 420 questions with no indication of which ones still needed attention. The only progress-aware filter was "Incorrect," which only helped after getting answers wrong — there was no way to focus on untouched questions. Additionally, once quiz history accumulated, there was no way to start fresh without clearing localStorage manually.

## Approach

Added a new `'unanswered'` filter mode to the existing filter pill system, reusing the same `filterQuestions` infrastructure. The filter checks for absence in the `history` record — questions with no history entry are considered "new." A reset button with a confirmation modal clears all answer history while preserving bookmarks, since bookmarks represent intentional curation that shouldn't be lost with a progress reset.

Also added ESLint, Prettier, and Vitest as dev tooling to catch issues during release validation. These were missing from the initial release and blocked the release skill's `npm run lint`, `npm run format:check`, and `npm run test` checks.

## Changes

### Unanswered filter

- Added `'unanswered'` to the `FilterMode` union type
- Added filter case: `questions.filter(q => !state.history[q.id])` — returns questions with no history entry
- Label displays as "New" in the filter pill bar
- Empty state message: "All questions answered! Reset progress to start over."

### Reset progress

- Added `resetProgress()` method to `QuizStateManager` — sets `this.history = {}`, triggers localStorage sync via existing `$effect`
- Reset button appears only when history exists (`hasHistory` derived state)
- Confirmation modal with backdrop dismiss, Cancel/Reset actions
- Red-accented button styling to signal destructive action
- Bookmarks are explicitly preserved

### Dev tooling

- ESLint with `eslint-plugin-svelte` and `typescript-eslint` for TS/Svelte linting
- Prettier with `prettier-plugin-svelte` for format checking
- Vitest for unit tests
- Fixed lint issues: removed unused imports, added `{#each}` keys, disabled `svelte/no-navigation-without-resolve`
- Added 15 unit tests covering `shuffle`, `checkAnswer`, `getRequiredSelections`, `isMultiAnswer`, and `filterQuestions`

## Files Modified

| File                                                                       | Change                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [src/lib/types.ts](src/lib/types.ts)                                       | Added `'unanswered'` to `FilterMode` union                     |
| [src/lib/utils.ts](src/lib/utils.ts)                                       | Added `unanswered` filter case and label                       |
| [src/lib/state.svelte.ts](src/lib/state.svelte.ts)                         | Added `resetProgress()` method                                 |
| [src/lib/components/FilterBar.svelte](src/lib/components/FilterBar.svelte) | Added `'unanswered'` to filter pill list                       |
| [src/routes/+page.svelte](src/routes/+page.svelte)                         | Added Reset button, confirmation modal, unanswered empty state |
| [src/lib/utils.test.ts](src/lib/utils.test.ts)                             | Added tests for unanswered filter                              |
| [package.json](package.json)                                               | Added lint, format, format:check, test scripts                 |
| [eslint.config.js](eslint.config.js)                                       | ESLint flat config for TS + Svelte                             |
| [.prettierrc](.prettierrc)                                                 | Prettier config with svelte plugin                             |
| [.prettierignore](.prettierignore)                                         | Prettier ignore patterns                                       |

## Guard Rails

| Scenario                   | Behavior                                            |
| -------------------------- | --------------------------------------------------- |
| All questions answered     | "New" pill shows 0, empty state suggests reset      |
| Reset with no history      | Reset button hidden entirely                        |
| Reset preserves bookmarks  | Only `history` cleared, `bookmarks` array untouched |
| Dismiss modal via backdrop | Clicking outside modal closes it without resetting  |

## Verification

1. `pnpm run lint && pnpm run format:check && pnpm run test` — all pass
2. `pnpm run build` — static build succeeds
3. Open app, answer a few questions, verify "New" pill count decreases
4. Select "New" filter — only unanswered questions shown
5. Click Reset — confirmation modal appears, confirm — history cleared, "New" count returns to 420

## Breaking Changes

None
