<script lang="ts">
	const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

	let {
		index,
		text,
		selected = false,
		submitted = false,
		isCorrect = false,
		wasSelected = false,
		isMulti = false,
		onclick
	}: {
		index: number;
		text: string;
		selected?: boolean;
		submitted?: boolean;
		isCorrect?: boolean;
		wasSelected?: boolean;
		isMulti?: boolean;
		onclick?: () => void;
	} = $props();

	const stateClass = $derived.by(() => {
		if (!submitted) return selected ? 'selected' : '';
		if (isCorrect && wasSelected) return 'correct';
		if (isCorrect && !wasSelected) return 'missed';
		if (!isCorrect && wasSelected) return 'incorrect';
		return '';
	});
</script>

<button
	class="choice {stateClass}"
	disabled={submitted}
	{onclick}
>
	<span class="letter" class:check={isMulti}>
		{#if submitted && isCorrect}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5" /></svg>
		{:else if submitted && wasSelected && !isCorrect}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
		{:else}
			{LETTERS[index]}
		{/if}
	</span>
	<span class="text">{text}</span>
</button>

<style>
	.choice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		width: 100%;
		min-height: var(--touch-target);
		padding: 12px var(--space-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		text-align: left;
		transition: all var(--transition-fast);
	}

	.choice:not(:disabled):active {
		transform: scale(0.98);
	}

	.choice.selected {
		border-color: var(--color-selected-border);
		background: var(--color-selected);
	}

	.choice.correct {
		border-color: var(--color-correct);
		background: var(--color-correct-bg);
		color: #065f46;
	}

	.choice.incorrect {
		border-color: var(--color-incorrect);
		background: var(--color-incorrect-bg);
		color: #991b1b;
	}

	.choice.missed {
		border-color: var(--color-correct);
		border-style: dashed;
		background: var(--color-correct-bg);
		opacity: 0.7;
	}

	.choice:disabled {
		cursor: default;
	}

	.letter {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		border-radius: 6px;
		background: var(--color-bg);
		font-weight: 700;
		font-size: var(--font-size-sm);
		flex-shrink: 0;
	}

	.choice.selected .letter {
		background: var(--color-selected-border);
		color: white;
	}

	.choice.correct .letter {
		background: var(--color-correct);
		color: white;
	}

	.choice.incorrect .letter {
		background: var(--color-incorrect);
		color: white;
	}

	.letter svg {
		width: 16px;
		height: 16px;
	}

	.text {
		flex: 1;
		padding-top: 3px;
		line-height: 1.4;
	}
</style>
