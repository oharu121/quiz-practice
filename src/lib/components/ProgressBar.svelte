<script lang="ts">
	let { current, total }: { current: number; total: number } = $props();
	const pct = $derived(total > 0 ? ((current + 1) / total) * 100 : 0);
</script>

<div class="progress-container">
	<div class="progress-bar" style="width: {pct}%"></div>
</div>

<style>
	.progress-container {
		width: 100%;
		height: 3px;
		background: var(--color-border);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: var(--color-accent);
		transition: width var(--transition-normal);
		border-radius: 2px;
	}
</style>
