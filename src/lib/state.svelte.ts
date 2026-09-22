import type { QuizState } from './types';
import { mergeProgress, parseProgress, serializeProgress, summarizeImport } from './backup';

const STORAGE_KEY = 'aws_quiz_state';

const defaultState: QuizState = {
	bookmarks: [],
	history: {}
};

function loadFromStorage(): QuizState {
	if (typeof localStorage === 'undefined') return { ...defaultState };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...defaultState };
		return JSON.parse(raw) as QuizState;
	} catch {
		return { ...defaultState };
	}
}

function saveToStorage(state: QuizState) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

class QuizStateManager {
	bookmarks = $state<string[]>([]);
	history = $state<Record<string, QuizState['history'][string]>>({});

	constructor() {
		const saved = loadFromStorage();
		this.bookmarks = saved.bookmarks;
		this.history = saved.history;

		$effect.root(() => {
			$effect(() => {
				saveToStorage({
					bookmarks: this.bookmarks,
					history: this.history
				});
			});
		});
	}

	toggleBookmark(id: string) {
		const idx = this.bookmarks.indexOf(id);
		if (idx >= 0) {
			this.bookmarks.splice(idx, 1);
		} else {
			this.bookmarks.push(id);
		}
	}

	isBookmarked(id: string): boolean {
		return this.bookmarks.includes(id);
	}

	recordResult(id: string, correct: boolean) {
		const existing = this.history[id];
		this.history[id] = {
			attempts: (existing?.attempts ?? 0) + 1,
			correct: (existing?.correct ?? 0) + (correct ? 1 : 0),
			last_result: correct ? 'correct' : 'incorrect',
			last_seen: new Date().toISOString()
		};
	}

	getHistory(id: string) {
		return this.history[id];
	}

	resetProgress() {
		this.history = {};
	}

	snapshot(): QuizState {
		return { bookmarks: this.bookmarks, history: this.history };
	}

	exportProgress(): string {
		return serializeProgress(this.snapshot());
	}

	/** Describes what `importProgress` would change, without applying anything. */
	previewImport(raw: string) {
		return summarizeImport(this.snapshot(), parseProgress(raw));
	}

	/** Throws BackupParseError if `raw` is not a valid backup; state is left untouched. */
	importProgress(raw: string) {
		const merged = mergeProgress(this.snapshot(), parseProgress(raw));
		// Assign fresh containers so the persisting $effect re-runs.
		this.bookmarks = [...merged.bookmarks];
		this.history = { ...merged.history };
	}
}

export const quizState = new QuizStateManager();
