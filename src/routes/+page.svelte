<script lang="ts">
	import { goto } from '$app/navigation';
	import type { FilterMode, Question } from '$lib/types';
	import { filterQuestions, shuffle } from '$lib/utils';
	import { quizState } from '$lib/state.svelte';
	import { quizEngine } from '$lib/quiz-engine.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import QuestionCard from '$lib/components/QuestionCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	// Will be replaced with actual data once translation is done
	import questionsData from '$lib/data/questions.json';
	const allQuestions: Question[] = questionsData as Question[];

	let activeFilter = $state<FilterMode>('all');
	let shuffleEnabled = $state(false);

	const filtered = $derived(
		filterQuestions(allQuestions, activeFilter, {
			bookmarks: quizState.bookmarks,
			history: quizState.history
		})
	);

	function startQuiz() {
		const questions = shuffleEnabled ? shuffle(filtered) : filtered;
		quizEngine.init(questions);
		goto('/quiz');
	}

	function startFromQuestion(question: Question) {
		const questions = filtered;
		const idx = questions.findIndex((q) => q.id === question.id);
		quizEngine.init(questions);
		if (idx >= 0) quizEngine.goTo(idx);
		goto('/quiz');
	}
</script>

<div class="browse-page">
	<header class="page-header">
		<h1>AWS Quiz Practice</h1>
		<span class="question-count">{allQuestions.length} questions</span>
	</header>

	<FilterBar questions={allQuestions} {activeFilter} onchange={(mode) => (activeFilter = mode)} />

	<div class="start-section">
		<label class="shuffle-toggle">
			<input type="checkbox" bind:checked={shuffleEnabled} />
			<span>Shuffle</span>
		</label>
		<button class="start-btn" onclick={startQuiz} disabled={filtered.length === 0}>
			Start Quiz ({filtered.length})
		</button>
	</div>

	{#if filtered.length === 0}
		<EmptyState
			icon={activeFilter === 'bookmarked'
				? 'bookmark'
				: activeFilter === 'incorrect'
					? 'check'
					: 'search'}
			message={activeFilter === 'bookmarked'
				? 'No bookmarked questions yet. Bookmark questions while studying to review them here.'
				: activeFilter === 'incorrect'
					? 'No incorrect answers. Keep it up!'
					: 'No questions match this filter.'}
		/>
	{:else}
		<div class="question-list">
			{#each filtered as question (question.id)}
				<QuestionCard {question} onclick={() => startFromQuestion(question)} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.browse-page {
		padding-top: var(--space-md);
	}

	.page-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0 var(--space-md);
		margin-bottom: var(--space-sm);
	}

	.page-header h1 {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 700;
	}

	.question-count {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.start-section {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md) var(--space-md);
	}

	.shuffle-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		cursor: pointer;
		white-space: nowrap;
	}

	.shuffle-toggle input {
		accent-color: var(--color-accent);
		width: 18px;
		height: 18px;
	}

	.start-btn {
		flex: 1;
		padding: 10px var(--space-md);
		background: var(--color-accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: var(--font-size-base);
		min-height: var(--touch-target);
		transition: background var(--transition-fast);
	}

	.start-btn:active {
		background: var(--color-accent-hover);
	}

	.start-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.question-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: 0 var(--space-md);
	}
</style>
