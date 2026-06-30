import type { Question } from './types';
import { checkAnswer, isMultiAnswer, getRequiredSelections } from './utils';
import { quizState } from './state.svelte';

class QuizEngine {
	questions = $state<Question[]>([]);
	currentIndex = $state(0);
	selectedAnswers = $state<Record<string, number[]>>({});
	submittedSet = $state<Set<string>>(new Set());
	resultMap = $state<Record<string, boolean>>({});

	current = $derived(this.questions[this.currentIndex]);
	total = $derived(this.questions.length);
	isActive = $derived(this.questions.length > 0);
	isMulti = $derived(this.current ? isMultiAnswer(this.current) : false);
	requiredCount = $derived(this.current ? getRequiredSelections(this.current) : 1);
	answeredCount = $derived(this.submittedSet.size);
	correctCount = $derived(Object.values(this.resultMap).filter(Boolean).length);

	init(questions: Question[]) {
		this.questions = questions;
		this.currentIndex = 0;
		this.selectedAnswers = {};
		this.submittedSet = new Set();
		this.resultMap = {};
	}

	getSelected(): number[] {
		if (!this.current) return [];
		return this.selectedAnswers[this.current.id] ?? [];
	}

	toggleChoice(choiceIndex: number) {
		if (!this.current || this.isSubmitted()) return;
		const id = this.current.id;
		const current = this.selectedAnswers[id] ?? [];

		if (this.isMulti) {
			const idx = current.indexOf(choiceIndex);
			if (idx >= 0) {
				this.selectedAnswers[id] = current.filter((i) => i !== choiceIndex);
			} else {
				this.selectedAnswers[id] = [...current, choiceIndex];
			}
		} else {
			this.selectedAnswers[id] = [choiceIndex];
		}
	}

	isSelected(choiceIndex: number): boolean {
		return this.getSelected().includes(choiceIndex);
	}

	canSubmit(): boolean {
		if (!this.current || this.isSubmitted()) return false;
		const selected = this.getSelected();
		return selected.length === this.requiredCount;
	}

	submit(): boolean | null {
		if (!this.current || !this.canSubmit()) return null;
		const id = this.current.id;
		const correct = checkAnswer(this.getSelected(), this.current.correct_index);
		this.submittedSet = new Set([...this.submittedSet, id]);
		this.resultMap[id] = correct;
		quizState.recordResult(id, correct);
		return correct;
	}

	isSubmitted(): boolean {
		return this.current ? this.submittedSet.has(this.current.id) : false;
	}

	getResult(): boolean | undefined {
		return this.current ? this.resultMap[this.current.id] : undefined;
	}

	next() {
		if (this.currentIndex < this.total - 1) this.currentIndex++;
	}

	prev() {
		if (this.currentIndex > 0) this.currentIndex--;
	}

	goTo(index: number) {
		if (index >= 0 && index < this.total) this.currentIndex = index;
	}

	hasNext = $derived(this.currentIndex < this.questions.length - 1);
	hasPrev = $derived(this.currentIndex > 0);
}

export const quizEngine = new QuizEngine();
