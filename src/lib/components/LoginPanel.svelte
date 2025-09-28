<script lang="ts">
	export let authHandle = '';
	export let authError: string | null = null;
	export let onClose: (() => void) | null = null;
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-8">
<div class="surface-card w-full max-w-md space-y-6 rounded-xl border border-white/20 bg-slate-950 p-6" role="dialog" aria-modal="true">
	<div class="flex items-start justify-between">
		<div>
			<h2 class="text-lg font-semibold text-slate-100">Sign in</h2>
			<p class="text-xs text-slate-400">Redirects you to Bluesky for approval.</p>
		</div>
		{#if onClose}
			<button
				type="button"
				class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
				onclick={onClose}
				aria-label="Close sign-in panel"
			>
				✕
			</button>
		{/if}
	</div>

	<form method="get" action="/auth/login" class="space-y-4">
		<div class="space-y-2">
			<label for="handle" class="text-xs font-semibold uppercase tracking-wide text-slate-300">
				Handle or DID
			</label>
			<input
				type="text"
				id="handle"
				name="handle"
				required
				autocomplete="username"
				value={authHandle}
				class="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 shadow-inner shadow-black/30 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
			/>
		</div>

		{#if authError}
			<p class="rounded-lg border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm text-red-100" aria-live="polite">
				{authError}
			</p>
		{/if}

		<button type="submit" class="button-primary w-full">Continue with Bluesky</button>
	</form>
</div>
</div>
