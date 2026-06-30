<script lang="ts">
	import { goto } from '$app/navigation';
	import { quizEngine } from '$lib/quiz-engine.svelte';
	import { quizState } from '$lib/state.svelte';
	import { isMultiAnswer, getRequiredSelections } from '$lib/utils';
	import { swipeable } from '$lib/actions/swipeable';
	import ChoiceButton from '$lib/components/ChoiceButton.svelte';
	import BookmarkButton from '$lib/components/BookmarkButton.svelte';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { slide } from 'svelte/transition';

	if (!quizEngine.isActive) {
		goto('/');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') quizEngine.next();
		else if (e.key === 'ArrowLeft') quizEngine.prev();
		else if (e.key === 'Enter' && quizEngine.canSubmit()) quizEngine.submit();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if quizEngine.current}
	<div class="quiz-page">
		<div class="quiz-header">
			<div class="quiz-meta">
				<span class="quiz-progress">Q {quizEngine.currentIndex + 1}/{quizEngine.total}</span>
				<CategoryBadge category={quizEngine.current.category} />
			</div>
			<div class="quiz-actions">
				<span class="score">
					{quizEngine.correctCount}/{quizEngine.answeredCount}
				</span>
				<BookmarkButton questionId={quizEngine.current.id} />
			</div>
		</div>

		<ProgressBar current={quizEngine.currentIndex} total={quizEngine.total} />

		<div
			class="quiz-body"
			use:swipeable={{ onLeft: () => quizEngine.next(), onRight: () => quizEngine.prev() }}
		>
			<div class="question-text">
				<p>{quizEngine.current.question}</p>
				{#if quizEngine.isMulti}
					<span class="select-hint">Select {quizEngine.requiredCount}</span>
				{/if}
			</div>

			<div class="choices">
				{#each quizEngine.current.choices as choice, i}
					<ChoiceButton
						index={i}
						text={choice}
						selected={quizEngine.isSelected(i)}
						submitted={quizEngine.isSubmitted()}
						isCorrect={Array.isArray(quizEngine.current.correct_index)
							? quizEngine.current.correct_index.includes(i)
							: quizEngine.current.correct_index === i}
						wasSelected={quizEngine.isSelected(i)}
						isMulti={quizEngine.isMulti}
						onclick={() => quizEngine.toggleChoice(i)}
					/>
				{/each}
			</div>

			{#if !quizEngine.isSubmitted()}
				<button
					class="submit-btn"
					disabled={!quizEngine.canSubmit()}
					onclick={() => quizEngine.submit()}
				>
					{#if quizEngine.isMulti && quizEngine.getSelected().length < quizEngine.requiredCount}
						Select {quizEngine.requiredCount - quizEngine.getSelected().length} more
					{:else}
						Submit Answer
					{/if}
				</button>
			{:else}
				<div class="result-banner" class:correct={quizEngine.getResult()} class:incorrect={!quizEngine.getResult()} transition:slide>
					{quizEngine.getResult() ? 'Correct!' : 'Incorrect'}
				</div>
				<div class="explanation" transition:slide>
					<h3>Explanation</h3>
					<p>{quizEngine.current.explanation}</p>
				</div>
			{/if}
		</div>

		<div class="quiz-nav">
			<button class="nav-btn" disabled={!quizEngine.hasPrev} onclick={() => quizEngine.prev()}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
				Prev
			</button>
			<button class="nav-btn" disabled={!quizEngine.hasNext} onclick={() => quizEngine.next()}>
				Next
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" /></svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.quiz-page {
		display: flex;
		flex-direction: column;
		min-height: calc(100dvh - var(--nav-height) - var(--safe-bottom));
	}

	.quiz-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-md) var(--space-sm);
	}

	.quiz-meta {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.quiz-progress {
		font-weight: 700;
		font-size: var(--font-size-sm);
	}

	.quiz-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.score {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-secondary);
		padding: 4px 8px;
		background: var(--color-bg);
		border-radius: var(--radius-sm);
	}

	.quiz-body {
		flex: 1;
		padding: var(--space-md);
		overflow-y: auto;
	}

	.question-text {
		margin-bottom: var(--space-lg);
	}

	.question-text p {
		margin: 0;
		font-size: var(--font-size-base);
		line-height: 1.6;
		font-weight: 500;
	}

	.select-hint {
		display: inline-block;
		margin-top: var(--space-sm);
		padding: 2px 10px;
		background: #fef3c7;
		color: #92400e;
		border-radius: 999px;
		font-size: var(--font-size-xs);
		font-weight: 600;
	}

	.choices {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.submit-btn {
		width: 100%;
		padding: 12px;
		background: var(--color-accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: var(--font-size-base);
		min-height: var(--touch-target);
		transition: all var(--transition-fast);
	}

	.submit-btn:active:not(:disabled) {
		background: var(--color-accent-hover);
		transform: scale(0.98);
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.result-banner {
		text-align: center;
		padding: 10px;
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: var(--font-size-lg);
		margin-bottom: var(--space-md);
	}

	.result-banner.correct {
		background: var(--color-correct-bg);
		color: var(--color-correct);
	}

	.result-banner.incorrect {
		background: var(--color-incorrect-bg);
		color: var(--color-incorrect);
	}

	.explanation {
		padding: var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.explanation h3 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.explanation p {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: 1.6;
		color: var(--color-text);
	}

	.quiz-nav {
		display: flex;
		gap: var(--space-md);
		padding: var(--space-md);
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.nav-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		min-height: var(--touch-target);
		padding: 10px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-weight: 600;
		font-size: var(--font-size-sm);
		transition: all var(--transition-fast);
	}

	.nav-btn:active:not(:disabled) {
		background: var(--color-bg);
		transform: scale(0.98);
	}

	.nav-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.nav-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
