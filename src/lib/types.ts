export type Category =
	'CLF_Beginner' | 'CLF_Theme' | 'CLF_Multi' | 'AIF_Beginner' | 'AIF_Theme' | 'AIF_Multi';

export interface Question {
	id: string;
	category: Category;
	question: string;
	choices: string[];
	correct_answer: string | string[];
	correct_index: number | number[];
	explanation: string;
}

export interface QuestionHistory {
	attempts: number;
	correct: number;
	last_result: 'correct' | 'incorrect';
	last_seen: string;
}

export interface QuizState {
	bookmarks: string[];
	history: Record<string, QuestionHistory>;
}

export type FilterMode = 'all' | 'clf' | 'aif' | 'bookmarked' | 'incorrect' | 'unanswered';
