import type { Category, FilterMode, Question, QuizState } from './types';

export function shuffle<T>(array: T[]): T[] {
	const a = [...array];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function filterQuestions(
	questions: Question[],
	mode: FilterMode,
	state: QuizState
): Question[] {
	switch (mode) {
		case 'all':
			return questions;
		case 'clf':
			return questions.filter((q) => q.category.startsWith('CLF'));
		case 'aif':
			return questions.filter((q) => q.category.startsWith('AIF'));
		case 'bookmarked':
			return questions.filter((q) => state.bookmarks.includes(q.id));
		case 'incorrect':
			return questions.filter((q) => state.history[q.id]?.last_result === 'incorrect');
	}
}

export function checkAnswer(selected: number[], correctIndex: number | number[]): boolean {
	const correct = Array.isArray(correctIndex) ? correctIndex : [correctIndex];
	if (selected.length !== correct.length) return false;
	const sortedSelected = [...selected].sort((a, b) => a - b);
	const sortedCorrect = [...correct].sort((a, b) => a - b);
	return sortedSelected.every((v, i) => v === sortedCorrect[i]);
}

export function getRequiredSelections(question: Question): number {
	return Array.isArray(question.correct_index) ? question.correct_index.length : 1;
}

export function isMultiAnswer(question: Question): boolean {
	return Array.isArray(question.correct_index);
}

export const CATEGORY_LABELS: Record<Category, string> = {
	CLF_Beginner: 'CLF Beginner',
	CLF_Theme: 'CLF Theme',
	CLF_Multi: 'CLF Multi-Select',
	AIF_Beginner: 'AIF Beginner',
	AIF_Theme: 'AIF Theme',
	AIF_Multi: 'AIF Multi-Select'
};

export const FILTER_LABELS: Record<FilterMode, string> = {
	all: 'All',
	clf: 'CLF',
	aif: 'AIF',
	bookmarked: 'Bookmarked',
	incorrect: 'Incorrect'
};
