<script lang="ts">
	let { icon = 'bookmark', message = 'Nothing here yet' }: { icon?: string; message?: string } = $props();
</script>

<div class="empty-state">
	{#if icon === 'bookmark'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
			<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
		</svg>
	{:else if icon === 'check'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
			<circle cx="12" cy="12" r="10" />
			<path d="M9 12l2 2 4-4" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
			<circle cx="11" cy="11" r="8" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
	{/if}
	<p>{message}</p>
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-xl) var(--space-md);
		color: var(--color-text-secondary);
		text-align: center;
		min-height: 200px;
	}

	.empty-state svg {
		width: 48px;
		height: 48px;
		margin-bottom: var(--space-md);
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0;
		font-size: var(--font-size-sm);
	}
</style>
