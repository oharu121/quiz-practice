import { describe, it, expect } from 'vitest';
import {
	shuffle,
	checkAnswer,
	getRequiredSelections,
	isMultiAnswer,
	filterQuestions
} from './utils';
import type { Question, QuizState } from './types';

describe('shuffle', () => {
	it('returns array of same length', () => {
		const arr = [1, 2, 3, 4, 5];
		expect(shuffle(arr)).toHaveLength(arr.length);
	});

	it('does not mutate original', () => {
		const arr = [1, 2, 3];
		shuffle(arr);
		expect(arr).toEqual([1, 2, 3]);
	});

	it('contains same elements', () => {
		const arr = [1, 2, 3, 4, 5];
		expect(shuffle(arr).sort()).toEqual(arr.sort());
	});
});

describe('checkAnswer', () => {
	it('single correct answer', () => {
		expect(checkAnswer([2], 2)).toBe(true);
	});

	it('single wrong answer', () => {
		expect(checkAnswer([1], 2)).toBe(false);
	});

	it('multi correct answers', () => {
		expect(checkAnswer([0, 3], [3, 0])).toBe(true);
	});

	it('multi wrong answers', () => {
		expect(checkAnswer([0, 1], [0, 3])).toBe(false);
	});

	it('wrong count', () => {
		expect(checkAnswer([0], [0, 3])).toBe(false);
	});
});

describe('getRequiredSelections', () => {
	it('single answer question', () => {
		const q = { correct_index: 2 } as Parameters<typeof getRequiredSelections>[0];
		expect(getRequiredSelections(q)).toBe(1);
	});

	it('multi answer question', () => {
		const q = { correct_index: [0, 3] } as Parameters<typeof getRequiredSelections>[0];
		expect(getRequiredSelections(q)).toBe(2);
	});
});

describe('isMultiAnswer', () => {
	it('single', () => {
		const q = { correct_index: 1 } as Parameters<typeof isMultiAnswer>[0];
		expect(isMultiAnswer(q)).toBe(false);
	});

	it('multi', () => {
		const q = { correct_index: [0, 2] } as Parameters<typeof isMultiAnswer>[0];
		expect(isMultiAnswer(q)).toBe(true);
	});
});

describe('filterQuestions', () => {
	const questions: Question[] = [
		{
			id: 'q1',
			category: 'CLF_Beginner',
			question: 'Q1',
			choices: ['a', 'b'],
			correct_answer: 'a',
			correct_index: 0,
			explanation: ''
		},
		{
			id: 'q2',
			category: 'AIF_Beginner',
			question: 'Q2',
			choices: ['a', 'b'],
			correct_answer: 'b',
			correct_index: 1,
			explanation: ''
		}
	];

	it('unanswered returns only questions without history', () => {
		const state: QuizState = {
			bookmarks: [],
			history: {
				q1: { attempts: 1, correct: 1, last_result: 'correct', last_seen: '' }
			}
		};
		const result = filterQuestions(questions, 'unanswered', state);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('q2');
	});

	it('unanswered returns all when no history', () => {
		const state: QuizState = { bookmarks: [], history: {} };
		expect(filterQuestions(questions, 'unanswered', state)).toHaveLength(2);
	});

	it('unanswered returns none when all answered', () => {
		const state: QuizState = {
			bookmarks: [],
			history: {
				q1: { attempts: 1, correct: 1, last_result: 'correct', last_seen: '' },
				q2: { attempts: 1, correct: 0, last_result: 'incorrect', last_seen: '' }
			}
		};
		expect(filterQuestions(questions, 'unanswered', state)).toHaveLength(0);
	});
});
