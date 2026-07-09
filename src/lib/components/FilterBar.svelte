<script lang="ts">
	import type { FilterMode, Question } from '$lib/types';
	import { FILTER_LABELS, filterQuestions } from '$lib/utils';
	import { quizState } from '$lib/state.svelte';

	let {
		questions,
		activeFilter,
		onchange
	}: {
		questions: Question[];
		activeFilter: FilterMode;
		onchange: (mode: FilterMode) => void;
	} = $props();

	const filters: FilterMode[] = ['all', 'clf', 'aif', 'bookmarked', 'incorrect', 'unanswered'];

	function getCount(mode: FilterMode): number {
		return filterQuestions(questions, mode, {
			bookmarks: quizState.bookmarks,
			history: quizState.history
		}).length;
	}
</script>

<div class="filter-bar">
	{#each filters as mode (mode)}
		<button class="filter-pill" class:active={activeFilter === mode} onclick={() => onchange(mode)}>
			{FILTER_LABELS[mode]}
			<span class="count">{getCount(mode)}</span>
		</button>
	{/each}
</div>

<style>
	.filter-bar {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.filter-bar::-webkit-scrollbar {
		display: none;
	}

	.filter-pill {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		font-size: var(--font-size-sm);
		font-weight: 500;
		white-space: nowrap;
		transition: all var(--transition-fast);
		min-height: 36px;
	}

	.filter-pill.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.filter-pill:active {
		transform: scale(0.95);
	}

	.count {
		font-size: var(--font-size-xs);
		opacity: 0.7;
	}
</style>
