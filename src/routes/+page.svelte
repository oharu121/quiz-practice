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
	let showResetConfirm = $state(false);

	const hasHistory = $derived(Object.keys(quizState.history).length > 0);

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
		{#if hasHistory}
			<button class="reset-btn" onclick={() => (showResetConfirm = true)}>Reset</button>
		{/if}
		<button class="start-btn" onclick={startQuiz} disabled={filtered.length === 0}>
			Start Quiz ({filtered.length})
		</button>
	</div>

	{#if showResetConfirm}
		<div class="modal-backdrop" onclick={() => (showResetConfirm = false)} role="presentation">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
				<h2>Reset Progress</h2>
				<p>Clear all answer history? Bookmarks will be kept.</p>
				<div class="modal-actions">
					<button class="modal-cancel" onclick={() => (showResetConfirm = false)}>Cancel</button>
					<button
						class="modal-confirm"
						onclick={() => {
							quizState.resetProgress();
							showResetConfirm = false;
						}}>Reset</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if filtered.length === 0}
		<EmptyState
			icon={activeFilter === 'bookmarked'
				? 'bookmark'
				: activeFilter === 'unanswered'
					? 'check'
					: activeFilter === 'incorrect'
						? 'check'
						: 'search'}
			message={activeFilter === 'bookmarked'
				? 'No bookmarked questions yet. Bookmark questions while studying to review them here.'
				: activeFilter === 'unanswered'
					? 'All questions answered! Reset progress to start over.'
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

	.reset-btn {
		padding: 6px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-incorrect);
		white-space: nowrap;
		min-height: 36px;
	}

	.reset-btn:active {
		background: var(--color-incorrect-bg);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: var(--space-md);
	}

	.modal {
		background: var(--color-surface);
		border-radius: var(--radius-lg, 12px);
		padding: var(--space-lg, 24px);
		max-width: 320px;
		width: 100%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.modal h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-base);
		font-weight: 700;
	}

	.modal p {
		margin: 0 0 var(--space-lg, 24px);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.modal-cancel {
		padding: 8px 16px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-weight: 500;
		font-size: var(--font-size-sm);
		min-height: var(--touch-target);
	}

	.modal-confirm {
		padding: 8px 16px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-incorrect);
		color: white;
		font-weight: 600;
		font-size: var(--font-size-sm);
		min-height: var(--touch-target);
	}

	.modal-confirm:active {
		opacity: 0.8;
	}

	.question-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: 0 var(--space-md);
	}
</style>
