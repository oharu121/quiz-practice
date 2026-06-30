<script lang="ts">
	import { page } from '$app/state';
</script>

<nav class="bottom-nav">
	<a href="/" class="nav-item" class:active={page.url.pathname === '/'}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</svg>
		<span>Browse</span>
	</a>
	<a href="/quiz" class="nav-item" class:active={page.url.pathname === '/quiz'}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" />
			<polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
		</svg>
		<span>Quiz</span>
	</a>
	<a href="/review" class="nav-item" class:active={page.url.pathname === '/review'}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
		</svg>
		<span>Review</span>
	</a>
</nav>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		padding-bottom: var(--safe-bottom);
		z-index: 100;
	}

	.nav-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: var(--touch-target);
		padding: var(--space-sm) 0;
		color: var(--color-text-secondary);
		transition: color var(--transition-fast);
		text-decoration: none;
	}

	.nav-item.active {
		color: var(--color-accent);
	}

	.nav-item svg {
		width: 22px;
		height: 22px;
	}

	.nav-item span {
		font-size: var(--font-size-xs);
		font-weight: 500;
	}
</style>
