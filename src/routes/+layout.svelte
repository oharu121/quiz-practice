<script lang="ts">
	import '../app.css';
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>AWS Quiz Practice</title>
</svelte:head>

<div class="app-shell">
	<main class="app-content">
		{@render children()}
	</main>
	<BottomNav />
</div>

<style>
	.app-shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.app-content {
		flex: 1;
		padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + var(--space-md));
	}
</style>
