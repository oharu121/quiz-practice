<script lang="ts">
	import { quizState } from '$lib/state.svelte';

	let { questionId }: { questionId: string } = $props();

	function toggle(e: Event) {
		e.stopPropagation();
		quizState.toggleBookmark(questionId);
	}
</script>

<button
	class="bookmark-btn"
	class:active={quizState.isBookmarked(questionId)}
	onclick={toggle}
	aria-label={quizState.isBookmarked(questionId) ? 'Remove bookmark' : 'Add bookmark'}
>
	<svg
		viewBox="0 0 24 24"
		fill={quizState.isBookmarked(questionId) ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
	>
		<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
	</svg>
</button>

<style>
	.bookmark-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border: none;
		background: none;
		color: var(--color-text-secondary);
		padding: 0;
		transition: transform var(--transition-fast);
	}

	.bookmark-btn:active {
		transform: scale(0.85);
	}

	.bookmark-btn.active {
		color: var(--color-accent);
	}

	.bookmark-btn svg {
		width: 22px;
		height: 22px;
	}
</style>
