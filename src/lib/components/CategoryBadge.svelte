<script lang="ts">
	import type { Category } from '$lib/types';
	import { CATEGORY_LABELS } from '$lib/utils';

	let { category }: { category: Category } = $props();
</script>

<span class="badge" class:clf={category.startsWith('CLF')} class:aif={category.startsWith('AIF')}>
	{CATEGORY_LABELS[category]}
</span>

<style>
	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: var(--font-size-xs);
		font-weight: 600;
		white-space: nowrap;
	}

	.clf {
		background: #dbeafe;
		color: #1e40af;
	}

	.aif {
		background: #fce7f3;
		color: #9d174d;
	}
</style>
