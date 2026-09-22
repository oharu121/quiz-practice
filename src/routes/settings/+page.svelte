<script lang="ts">
	import { quizState } from '$lib/state.svelte';
	import { BackupParseError } from '$lib/backup';

	type Feedback = { kind: 'ok' | 'error'; text: string } | null;

	let backupFeedback = $state<Feedback>(null);
	let restoreFeedback = $state<Feedback>(null);
	let restoreText = $state('');
	let showResetConfirm = $state(false);
	let pendingImport = $state<{
		raw: string;
		summary: ReturnType<typeof quizState.previewImport>;
	} | null>(null);

	let serviceWorkerReady = $state(false);
	let cachedVersion = $state<string | null>(null);

	const answeredCount = $derived(Object.keys(quizState.history).length);
	const bookmarkCount = $derived(quizState.bookmarks.length);

	$effect(() => {
		if (!('serviceWorker' in navigator)) return;
		serviceWorkerReady = navigator.serviceWorker.controller !== null;
		if (!('caches' in window)) return;
		// The worker writes this on activate, not install, so it names the worker actually
		// serving this page rather than one still waiting to take over.
		caches
			.match('/__sw-version')
			.then((response) => response?.text())
			.then((text) => (cachedVersion = text ?? null))
			.catch(() => (cachedVersion = null));
	});

	/** Both modals: take focus on open, close on Escape, restore focus on close. */
	function modal(node: HTMLElement) {
		const previous = document.activeElement as HTMLElement | null;
		node.focus();

		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') closeModals();
		}
		node.addEventListener('keydown', onKeydown);

		return {
			destroy() {
				node.removeEventListener('keydown', onKeydown);
				previous?.focus();
			}
		};
	}

	function closeModals() {
		pendingImport = null;
		showResetConfirm = false;
	}

	function backupFilename() {
		const stamp = new Date().toISOString().slice(0, 10);
		return `aws-quiz-progress-${stamp}.json`;
	}

	async function copyBackup() {
		try {
			await navigator.clipboard.writeText(quizState.exportProgress());
			backupFeedback = { kind: 'ok', text: 'Backup copied to clipboard.' };
		} catch {
			backupFeedback = {
				kind: 'error',
				text: 'Clipboard blocked by the browser. Use Download instead.'
			};
		}
	}

	function downloadBackup() {
		const blob = new Blob([quizState.exportProgress()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = backupFilename();
		link.click();
		URL.revokeObjectURL(url);
		backupFeedback = { kind: 'ok', text: `Saved as ${backupFilename()}.` };
	}

	function stageImport(raw: string) {
		restoreFeedback = null;
		try {
			pendingImport = { raw, summary: quizState.previewImport(raw) };
		} catch (error) {
			pendingImport = null;
			restoreFeedback = {
				kind: 'error',
				text:
					error instanceof BackupParseError
						? error.message
						: 'Could not read that backup. Nothing was changed.'
			};
		}
	}

	function applyImport() {
		if (!pendingImport) return;
		try {
			quizState.importProgress(pendingImport.raw);
			restoreText = '';
			restoreFeedback = { kind: 'ok', text: 'Progress restored.' };
		} catch (error) {
			restoreFeedback = {
				kind: 'error',
				text: error instanceof Error ? error.message : 'Restore failed. Nothing was changed.'
			};
		}
		pendingImport = null;
	}

	async function handleFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		stageImport(await file.text());
		input.value = '';
	}
</script>

<div class="settings-page">
	<header class="page-header">
		<h1>Settings</h1>
		<span class="summary">{answeredCount} answered · {bookmarkCount} bookmarked</span>
	</header>

	<section class="card">
		<h2>Offline</h2>
		{#if serviceWorkerReady}
			<p class="status ok">Ready offline{cachedVersion ? ` · version ${cachedVersion}` : ''}</p>
		{:else}
			<p class="status">
				Not cached yet. Reload once while online and check back. If it still says this, the browser
				is not running the service worker — add the site to your Home Screen and open it from the
				icon instead.
			</p>
		{/if}
	</section>

	<section class="card">
		<h2>Backup progress</h2>
		<p class="hint">
			Save a copy before switching browsers or installing to the Home Screen. Each one keeps its own
			separate storage, so progress does not follow you across automatically.
		</p>
		<div class="actions">
			<button class="btn" onclick={copyBackup}>Copy to clipboard</button>
			<button class="btn" onclick={downloadBackup}>Download .json</button>
		</div>
		{#if backupFeedback}
			<p class="feedback" class:error={backupFeedback.kind === 'error'}>{backupFeedback.text}</p>
		{/if}
	</section>

	<section class="card">
		<h2>Restore progress</h2>
		<textarea
			bind:value={restoreText}
			aria-label="Backup to restore"
			placeholder="Paste a backup here"
			rows="4"
			spellcheck="false"></textarea>
		<div class="actions">
			<button
				class="btn"
				disabled={restoreText.trim() === ''}
				onclick={() => stageImport(restoreText)}
			>
				Restore from paste
			</button>
			<label class="btn file-btn">
				Restore from file
				<input type="file" accept="application/json,.json" onchange={handleFile} />
			</label>
		</div>
		{#if restoreFeedback}
			<p class="feedback" class:error={restoreFeedback.kind === 'error'}>{restoreFeedback.text}</p>
		{/if}
	</section>

	<section class="card">
		<h2>Reset</h2>
		<p class="hint">Clears answer history. Bookmarks are kept.</p>
		<div class="actions">
			<button
				class="btn danger"
				disabled={answeredCount === 0}
				onclick={() => (showResetConfirm = true)}
			>
				Reset progress
			</button>
		</div>
	</section>
</div>

{#if pendingImport}
	<div class="modal-backdrop" onclick={closeModals} role="presentation">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="restore-modal-title"
			tabindex="-1"
			use:modal
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="restore-modal-title">Restore Progress</h2>
			<p>
				This backup holds {pendingImport.summary.totalAnswers} answered questions and
				{pendingImport.summary.totalBookmarks} bookmarks.
				{pendingImport.summary.newAnswers} would be new here,
				{pendingImport.summary.updatedAnswers} would replace what is stored here, and
				{pendingImport.summary.newBookmarks} bookmarks would be added.
			</p>
			<div class="modal-actions">
				<button class="modal-cancel" onclick={closeModals}>Cancel</button>
				<button class="modal-confirm accent" onclick={applyImport}>Restore</button>
			</div>
		</div>
	</div>
{/if}

{#if showResetConfirm}
	<div class="modal-backdrop" onclick={closeModals} role="presentation">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="reset-modal-title"
			tabindex="-1"
			use:modal
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="reset-modal-title">Reset Progress</h2>
			<p>Clear all answer history? Bookmarks will be kept.</p>
			<div class="modal-actions">
				<button class="modal-cancel" onclick={closeModals}>Cancel</button>
				<button
					class="modal-confirm"
					onclick={() => {
						quizState.resetProgress();
						showResetConfirm = false;
					}}>Reset</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-page {
		padding: var(--space-md) 0;
	}

	.page-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0 var(--space-md);
		margin-bottom: var(--space-sm);
	}

	.page-header h1 {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 700;
	}

	.summary {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		margin: var(--space-sm) var(--space-md);
		padding: var(--space-md);
	}

	.card h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-secondary);
	}

	.hint,
	.status {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.status.ok {
		color: var(--color-correct);
		font-weight: 600;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.btn {
		flex: 1 1 auto;
		padding: 8px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: var(--font-size-sm);
		font-weight: 600;
		min-height: var(--touch-target);
		white-space: nowrap;
	}

	.btn:active {
		background: var(--color-bg);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.btn.danger {
		color: var(--color-incorrect);
	}

	.btn.danger:active {
		background: var(--color-incorrect-bg);
	}

	.file-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	/* Visually hidden rather than display:none, which would drop the input out of the
	   tab order and out of a screen reader's list of form controls. */
	.file-btn input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	.file-btn:focus-within {
		outline: 2px solid var(--color-selected-border);
		outline-offset: 2px;
	}

	textarea {
		width: 100%;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--font-size-xs);
		padding: var(--space-sm);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-text);
		resize: vertical;
		margin-bottom: var(--space-sm);
	}

	.feedback {
		margin: var(--space-sm) 0 0;
		font-size: var(--font-size-sm);
		color: var(--color-correct);
	}

	.feedback.error {
		color: var(--color-incorrect);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: var(--space-md);
	}

	.modal {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		max-width: 320px;
		width: 100%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.modal h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-base);
		font-weight: 700;
		text-transform: none;
		letter-spacing: normal;
		color: var(--color-text);
	}

	.modal p {
		margin: 0 0 var(--space-lg);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.modal-cancel {
		padding: 8px 16px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-weight: 500;
		font-size: var(--font-size-sm);
		min-height: var(--touch-target);
	}

	.modal-confirm {
		padding: 8px 16px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-incorrect);
		color: white;
		font-weight: 600;
		font-size: var(--font-size-sm);
		min-height: var(--touch-target);
	}

	.modal-confirm.accent {
		background: var(--color-accent);
	}

	.modal-confirm:active {
		opacity: 0.8;
	}
</style>
