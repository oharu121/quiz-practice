# AWS Quiz App — Build Prompt

## Context

I have a JSON file (`keepitup_questions.json`) containing 420 AWS certification practice questions scraped from aws.keepitup.jp (Japanese). The site has no bookmark or review functionality, so I want to build a personal SPA for that.

**Step 1 (do first): Translate the JSON to English.**
**Step 2: Build the SvelteKit app.**

---

## Step 1: Translate the JSON

Translate `keepitup_questions.json` from Japanese to English using the Claude API (Anthropic SDK). Process in batches to stay within token limits.

Fields to translate per question:
- `question`
- `choices` (array of strings)
- `correct_answer` (string OR array of strings for multi-answer questions)
- `explanation`

Fields to keep unchanged:
- `id`, `category`, `correct_index`

Save output as `keepitup_questions_en.json` with the same structure.

### JSON Structure

```json
{
  "id": "CLF101C001",
  "category": "CLF_Beginner",
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "correct_answer": "...",
  "correct_index": 0,
  "explanation": "..."
}
```

Multi-answer questions have `correct_answer` and `correct_index` as arrays:

```json
{
  "id": "CLF301S001",
  "category": "CLF_Multi",
  "question": "... (Select 2.)",
  "choices": ["...", "...", "...", "...", "..."],
  "correct_answer": ["...", "..."],
  "correct_index": [0, 1],
  "explanation": "..."
}
```

### Categories (420 total)

| Category | Count | Description |
|---|---|---|
| `CLF_Beginner` | 49 | CLF-C02 beginner basics |
| `CLF_Theme` | 237 | CLF-C02 theme-based (4 domains) |
| `CLF_Multi` | 43 | CLF-C02 multiple-select questions |
| `AIF_Beginner` | 12 | AIF-C01 beginner basics |
| `AIF_Theme` | 74 | AIF-C01 theme-based (5 domains) |
| `AIF_Multi` | 5 | AIF-C01 multiple-select questions |

---

## Step 2: Build the SvelteKit App

### Tech Stack

- **SvelteKit** with `@sveltejs/adapter-static` (pure SPA, no SSR)
- **TypeScript**
- **localStorage** for all persistence (no backend, no DB)
- **pnpm** for package management (never npm/npx)
- Deploy target: **Vercel** (static output)

Setup:
```bash
pnpm create svelte@latest aws-quiz-app
# Choose: Skeleton project, TypeScript, no additional tools needed
cd aws-quiz-app
pnpm install
pnpm add -D @sveltejs/adapter-static
```

`svelte.config.js`:
```js
import adapter from '@sveltejs/adapter-static';
export default {
  kit: { adapter: adapter() }
};
```

`src/routes/+layout.ts`:
```ts
export const ssr = false;
export const prerender = false;
```

Place `keepitup_questions_en.json` in `src/lib/data/questions.json` and import it statically.

---

### App Features

#### 1. Browse Mode (`/`)
- List all questions, filterable by category
- Each question card shows: question text (truncated), category badge, bookmark icon
- Clicking a question goes to quiz mode for that question

#### 2. Quiz Mode (`/quiz`)
- Present questions one at a time
- For single-answer: radio buttons (A/B/C/D)
- For multi-answer: checkboxes — question text indicates how many to select (e.g. "Select 2")
- On submit: show correct/incorrect feedback + full explanation
- Buttons: Previous, Next, Bookmark toggle
- Track session score (correct / total answered)

#### 3. Review Mode (`/review`)
- Shows only bookmarked questions
- Same quiz UI as above
- Empty state if no bookmarks

#### 4. Filter / Start options on home
- Filter by: All / CLF only / AIF only / Bookmarked / Incorrect history
- Start quiz from filtered set

---

### localStorage Schema

```ts
// Key: "aws_quiz_state"
interface QuizState {
  bookmarks: string[];          // question IDs
  history: {
    [id: string]: {
      attempts: number;
      correct: number;
      last_result: 'correct' | 'incorrect';
      last_seen: string;        // ISO date
    }
  };
}
```

Helper: read/write via a Svelte store that syncs to localStorage.

---

### Key Implementation Notes

- `correct_index` can be `number` (single) or `number[]` (multi) — handle both cases in quiz logic
- Multi-answer: user must select exactly N answers before submitting; N is inferred from `correct_index.length`
- Explanation should only be shown after the user submits an answer, not before
- No routing library needed — SvelteKit file-based routing is sufficient
- Keep all state in a single Svelte writable store backed by localStorage; no server calls

---

### Suggested File Structure

```
src/
  lib/
    data/
      questions.json        # translated JSON
    stores/
      quiz.ts               # writable store + localStorage sync
    types.ts                # Question, QuizState types
  routes/
    +layout.svelte          # nav bar
    +layout.ts              # ssr=false
    +page.svelte            # home / browse
    quiz/
      +page.svelte          # quiz mode
    review/
      +page.svelte          # bookmarked questions
```
