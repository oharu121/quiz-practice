import type { QuestionHistory, QuizState } from './types';

/**
 * Wire format for an exported backup. The `state` field is deliberately the exact
 * shape held in localStorage, so a backup file can be diffed against storage by eye.
 */
export interface BackupFile {
	version: 1;
	exportedAt: string;
	state: QuizState;
}

export const BACKUP_VERSION = 1;

export class BackupParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BackupParseError';
	}
}

export function serializeProgress(state: QuizState): string {
	const backup: BackupFile = {
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		state: {
			bookmarks: [...state.bookmarks],
			history: { ...state.history }
		}
	};
	return JSON.stringify(backup, null, 2);
}

function isHistoryEntry(value: unknown): value is QuestionHistory {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.attempts === 'number' &&
		typeof entry.correct === 'number' &&
		(entry.last_result === 'correct' || entry.last_result === 'incorrect') &&
		typeof entry.last_seen === 'string'
	);
}

/**
 * Parses an exported backup. Rejects anything malformed rather than coercing, so a bad
 * paste fails loudly instead of being applied halfway.
 */
export function parseProgress(raw: string): QuizState {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new BackupParseError('Not valid JSON. Paste the whole backup, including the braces.');
	}

	if (typeof parsed !== 'object' || parsed === null) {
		throw new BackupParseError('Backup must be a JSON object.');
	}

	const file = parsed as Record<string, unknown>;
	if (file.version !== BACKUP_VERSION) {
		throw new BackupParseError(
			`Unsupported backup version ${String(file.version)}. This app reads version ${BACKUP_VERSION}.`
		);
	}

	if (typeof file.state !== 'object' || file.state === null) {
		throw new BackupParseError('Backup is missing its "state" field.');
	}

	const state = file.state as Record<string, unknown>;

	if (!Array.isArray(state.bookmarks) || state.bookmarks.some((id) => typeof id !== 'string')) {
		throw new BackupParseError('"bookmarks" must be a list of question IDs.');
	}

	if (typeof state.history !== 'object' || state.history === null || Array.isArray(state.history)) {
		throw new BackupParseError('"history" must be an object keyed by question ID.');
	}

	const history: Record<string, QuestionHistory> = {};
	for (const [id, entry] of Object.entries(state.history)) {
		if (!isHistoryEntry(entry)) {
			throw new BackupParseError(`History entry for "${id}" is missing or has invalid fields.`);
		}
		history[id] = entry;
	}

	return { bookmarks: state.bookmarks as string[], history };
}

/**
 * Combines an imported backup with whatever progress already exists on this device.
 *
 * Both arguments are treated as read-only: build and return a new QuizState rather than
 * mutating either one, because the caller assigns the result straight onto reactive state.
 *
 * The interesting case is not the first transfer (where `current` is empty and any rule
 * gives the same answer) but a later restore of an older backup onto a device that has
 * since been studied on.
 *
 * The rule is "never lose work": per question, the entry with more attempts wins, and a tie
 * goes to the later `last_seen`. Restoring a stale backup therefore cannot roll back a
 * question you have since answered again. Entries are kept whole rather than summed, so
 * importing the same backup twice is idempotent. Bookmarks union, because a resurrected
 * bookmark costs a tap and a lost one costs a question you meant to revisit.
 */
export function mergeProgress(current: QuizState, incoming: QuizState): QuizState {
	const history: Record<string, QuestionHistory> = { ...current.history };

	for (const [id, candidate] of Object.entries(incoming.history)) {
		const existing = history[id];
		if (!existing || wins(candidate, existing)) history[id] = candidate;
	}

	return {
		bookmarks: [...new Set([...current.bookmarks, ...incoming.bookmarks])],
		history
	};
}

/** ISO-8601 timestamps sort correctly as plain strings, which also tolerates an empty one. */
function wins(candidate: QuestionHistory, existing: QuestionHistory): boolean {
	if (candidate.attempts !== existing.attempts) return candidate.attempts > existing.attempts;
	return candidate.last_seen > existing.last_seen;
}

/**
 * Describes what an import would change, so the confirmation dialog can be specific
 * instead of asking the user to trust a blind overwrite.
 */
export function summarizeImport(current: QuizState, incoming: QuizState) {
	const newAnswers = Object.keys(incoming.history).filter((id) => !(id in current.history)).length;
	const updatedAnswers = Object.keys(incoming.history).filter(
		(id) => id in current.history && incoming.history[id].attempts !== current.history[id].attempts
	).length;
	const newBookmarks = incoming.bookmarks.filter((id) => !current.bookmarks.includes(id)).length;

	return {
		totalAnswers: Object.keys(incoming.history).length,
		totalBookmarks: incoming.bookmarks.length,
		newAnswers,
		updatedAnswers,
		newBookmarks
	};
}
