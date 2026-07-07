<script lang="ts">
	import type { Question } from '$lib/types';
	import { quizState } from '$lib/state.svelte';
	import CategoryBadge from './CategoryBadge.svelte';
	import BookmarkButton from './BookmarkButton.svelte';

	let { question, onclick }: { question: Question; onclick: () => void } = $props();

	const history = $derived(quizState.getHistory(question.id));
</script>

<button class="card" {onclick}>
	<div class="card-header">
		<span class="card-id">{question.id}</span>
		<CategoryBadge category={question.category} />
	</div>
	<p class="card-question">{question.question}</p>
	<div class="card-footer">
		<div class="card-status">
			{#if history}
				<span
					class="dot"
					class:correct={history.last_result === 'correct'}
					class:incorrect={history.last_result === 'incorrect'}
				></span>
				<span class="stat">{history.correct}/{history.attempts}</span>
			{/if}
		</div>
		<BookmarkButton questionId={question.id} />
	</div>
</button>

<style>
	.card {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		text-align: left;
		transition: all var(--transition-fast);
	}

	.card:active {
		transform: scale(0.99);
		background: var(--color-bg);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		margin-bottom: var(--space-sm);
	}

	.card-id {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.card-question {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		color: var(--color-text);
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: var(--space-sm);
	}

	.card-status {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.dot.correct {
		background: var(--color-correct);
	}

	.dot.incorrect {
		background: var(--color-incorrect);
	}

	.stat {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
	}
</style>
