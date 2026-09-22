import { describe, it, expect } from 'vitest';
import {
	BackupParseError,
	mergeProgress,
	parseProgress,
	serializeProgress,
	summarizeImport,
	BACKUP_VERSION
} from './backup';
import type { QuestionHistory, QuizState } from './types';

const sample: QuizState = {
	bookmarks: ['CLF101C001', 'AIF201C004'],
	history: {
		CLF101C001: {
			attempts: 2,
			correct: 1,
			last_result: 'correct',
			last_seen: '2026-09-01T00:00:00.000Z'
		},
		AIF201C004: {
			attempts: 1,
			correct: 0,
			last_result: 'incorrect',
			last_seen: '2026-09-02T00:00:00.000Z'
		}
	}
};

describe('serializeProgress / parseProgress', () => {
	it('round-trips a state unchanged', () => {
		expect(parseProgress(serializeProgress(sample))).toEqual(sample);
	});

	it('round-trips an empty state', () => {
		const empty: QuizState = { bookmarks: [], history: {} };
		expect(parseProgress(serializeProgress(empty))).toEqual(empty);
	});

	it('does not alias the input state', () => {
		const raw = serializeProgress(sample);
		sample.bookmarks.push('MUTATED');
		expect(parseProgress(raw).bookmarks).not.toContain('MUTATED');
		sample.bookmarks.pop();
	});

	it('stamps the current version and an ISO timestamp', () => {
		const file = JSON.parse(serializeProgress(sample));
		expect(file.version).toBe(BACKUP_VERSION);
		expect(() => new Date(file.exportedAt).toISOString()).not.toThrow();
	});
});

describe('parseProgress rejections', () => {
	it('rejects malformed JSON', () => {
		expect(() => parseProgress('{ not json')).toThrow(BackupParseError);
	});

	it('rejects a non-object payload', () => {
		expect(() => parseProgress('"a string"')).toThrow(BackupParseError);
	});

	it('rejects an unsupported version', () => {
		const raw = JSON.stringify({ version: 99, exportedAt: '', state: sample });
		expect(() => parseProgress(raw)).toThrow(/Unsupported backup version 99/);
	});

	it('rejects a missing state field', () => {
		const raw = JSON.stringify({ version: BACKUP_VERSION, exportedAt: '' });
		expect(() => parseProgress(raw)).toThrow(/missing its "state" field/);
	});

	it('rejects bookmarks that are not strings', () => {
		const raw = JSON.stringify({
			version: BACKUP_VERSION,
			exportedAt: '',
			state: { bookmarks: [1, 2], history: {} }
		});
		expect(() => parseProgress(raw)).toThrow(/"bookmarks" must be a list/);
	});

	it('rejects a history entry missing attempts', () => {
		const raw = JSON.stringify({
			version: BACKUP_VERSION,
			exportedAt: '',
			state: {
				bookmarks: [],
				history: { q1: { correct: 1, last_result: 'correct', last_seen: '' } }
			}
		});
		expect(() => parseProgress(raw)).toThrow(/History entry for "q1"/);
	});

	it('rejects a history entry with an unknown last_result', () => {
		const raw = JSON.stringify({
			version: BACKUP_VERSION,
			exportedAt: '',
			state: {
				bookmarks: [],
				history: { q1: { attempts: 1, correct: 1, last_result: 'maybe', last_seen: '' } }
			}
		});
		expect(() => parseProgress(raw)).toThrow(BackupParseError);
	});
});

describe('summarizeImport', () => {
	const current: QuizState = {
		bookmarks: ['CLF101C001'],
		history: {
			CLF101C001: { attempts: 1, correct: 1, last_result: 'correct', last_seen: '' }
		}
	};

	it('counts questions present only in the backup as new', () => {
		expect(summarizeImport(current, sample).newAnswers).toBe(1);
	});

	it('counts questions with a differing attempt count as updated', () => {
		expect(summarizeImport(current, sample).updatedAnswers).toBe(1);
	});

	it('counts bookmarks present only in the backup as new', () => {
		expect(summarizeImport(current, sample).newBookmarks).toBe(1);
	});

	it('reports nothing changed when importing an identical state', () => {
		const summary = summarizeImport(sample, sample);
		expect(summary.newAnswers).toBe(0);
		expect(summary.updatedAnswers).toBe(0);
		expect(summary.newBookmarks).toBe(0);
	});
});

describe('mergeProgress', () => {
	const entry = (attempts: number, last_seen: string, correct = attempts): QuestionHistory => ({
		attempts,
		correct,
		last_result: correct > 0 ? 'correct' : 'incorrect',
		last_seen
	});

	it('merging onto an empty state yields the backup verbatim', () => {
		expect(mergeProgress({ bookmarks: [], history: {} }, sample)).toEqual(sample);
	});

	it('preserves a question present only locally', () => {
		const local: QuizState = { bookmarks: [], history: { ONLY_LOCAL: entry(3, '2026-09-05') } };
		const merged = mergeProgress(local, sample);
		expect(merged.history.ONLY_LOCAL).toEqual(local.history.ONLY_LOCAL);
		expect(Object.keys(merged.history)).toHaveLength(3);
	});

	it('keeps the entry with more attempts, whichever side it is on', () => {
		const local: QuizState = { bookmarks: [], history: { q1: entry(5, '2026-01-01') } };
		const backup: QuizState = { bookmarks: [], history: { q1: entry(2, '2026-12-31') } };
		expect(mergeProgress(local, backup).history.q1.attempts).toBe(5);
		expect(mergeProgress(backup, local).history.q1.attempts).toBe(5);
	});

	it('breaks an attempts tie with the later last_seen, whichever side it is on', () => {
		const older: QuizState = { bookmarks: [], history: { q1: entry(2, '2026-03-01', 0) } };
		const newer: QuizState = { bookmarks: [], history: { q1: entry(2, '2026-09-01', 2) } };
		expect(mergeProgress(older, newer).history.q1).toEqual(newer.history.q1);
		expect(mergeProgress(newer, older).history.q1).toEqual(newer.history.q1);
	});

	it('keeps entries whole rather than summing, so a repeat import is idempotent', () => {
		const once = mergeProgress({ bookmarks: [], history: {} }, sample);
		expect(mergeProgress(once, sample)).toEqual(once);
	});

	it('cannot roll back progress made since the backup was taken', () => {
		const stale: QuizState = { bookmarks: [], history: { q1: entry(1, '2026-01-01', 0) } };
		const studiedSince: QuizState = { bookmarks: [], history: { q1: entry(4, '2026-09-01', 3) } };
		expect(mergeProgress(studiedSince, stale).history.q1).toEqual(studiedSince.history.q1);
	});

	it('unions bookmarks without duplicating', () => {
		const local: QuizState = { bookmarks: ['CLF101C001', 'LOCAL_ONLY'], history: {} };
		const merged = mergeProgress(local, sample);
		expect([...merged.bookmarks].sort()).toEqual(['AIF201C004', 'CLF101C001', 'LOCAL_ONLY']);
	});

	it('mutates neither input', () => {
		const local: QuizState = { bookmarks: ['LOCAL_ONLY'], history: { q1: entry(1, '2026-01-01') } };
		const localCopy = structuredClone(local);
		const backupCopy = structuredClone(sample);
		mergeProgress(local, sample);
		expect(local).toEqual(localCopy);
		expect(sample).toEqual(backupCopy);
	});
});
