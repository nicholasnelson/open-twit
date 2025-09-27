<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Session } from '$lib/server/session';

	type PageData = {
		session: Session | null;
	};

	type LoginFormState = {
		formType: 'login';
		message?: string;
		identifier?: string;
	};

	type TwitFormState = {
		formType: 'twit';
		message?: string;
		twitStatus?: 'success' | 'error';
		twitTimestamp?: string;
		cooldownExpiresAt?: string;
		twitUri?: string;
	};

	type FormState = LoginFormState | TwitFormState | null;

	let { data, form } = $props<{ data: PageData; form?: FormState }>();

	let cooldownExpiresAt = $state<string | null>(null);
	let now = $state(Date.now());

	const toCooldownMs = (expiresAt: string | null): number => {
		if (!expiresAt) return 0;
		return new Date(expiresAt).getTime() - now;
	};

	const cooldownRemainingMs = $derived(toCooldownMs(cooldownExpiresAt));
	const isCoolingDown = $derived(cooldownRemainingMs > 0);
	const cooldownRemainingSeconds = $derived(
		isCoolingDown ? Math.max(1, Math.ceil(cooldownRemainingMs / 1000)) : 0
	);
	const lastTwitTimestamp = $derived(
		form?.formType === 'twit' && form.twitStatus === 'success' && form.twitTimestamp
			? form.twitTimestamp
			: null
	);

	const lastTwitUri = $derived(
		form?.formType === 'twit' && form.twitStatus === 'success' && form.twitUri
			? form.twitUri
			: null
	);

	let timer: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		timer = setInterval(() => {
			now = Date.now();
		}, 250);

		return () => {
			if (timer) clearInterval(timer);
		};
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	$effect(() => {
		if (form?.formType === 'twit' && form.cooldownExpiresAt) {
			cooldownExpiresAt = form.cooldownExpiresAt;
		}
	});
</script>

<svelte:head>
	<title>atweet · Twit playground</title>
</svelte:head>

<main class="min-h-screen bg-slate-950 text-slate-100">
	<section class="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-16 md:flex-row md:items-start md:justify-between">
		<div class="flex-1 space-y-4">
			<h1 class="text-3xl font-semibold tracking-tight md:text-4xl">Twit playground</h1>
			<p class="text-sm text-slate-300 md:text-base">
				Authenticate with your AT Protocol handle using an app password to start twiting.
			</p>

		{#if data.session}
			<div class="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/40">
				<p class="text-sm text-slate-400">Signed in as</p>
				<p class="text-lg font-medium text-slate-100">{data.session.handle}</p>
				<p class="text-xs text-slate-500">{data.session.did}</p>

				<dl class="mt-4 space-y-2 text-sm text-slate-300">
					<div class="flex items-center justify-between">
						<dt class="text-slate-400">Service</dt>
						<dd class="font-mono text-xs">{data.session.service}</dd>
					</div>
				</dl>

				<form method="post" action="?/logout" class="mt-6">
					<button
						type="submit"
						class="inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-slate-900 transition hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
					>
						Sign out
					</button>
				</form>
			</div>
		{:else}
			<p class="text-xs text-slate-500">
				Need an app password? Generate one from your Bluesky account settings under "App passwords".
			</p>
		{/if}
		</div>

		<div class="w-full max-w-md md:w-96">
			{#if data.session}
				<div class="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/40">
					<h2 class="text-lg font-semibold text-slate-100">Fire a twit</h2>
					<p class="mt-2 text-sm text-slate-300">
						Record a timestamped twit event in your AT Protocol repo. The global feed will surface these in the next phase.
					</p>

					{#if form?.formType === 'twit' && form.twitStatus === 'success' && lastTwitTimestamp}
						<p
							class="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
							aria-live="polite"
						>
							Twit recorded at
							<time datetime={lastTwitTimestamp} class="font-mono text-xs">
								{new Date(lastTwitTimestamp).toLocaleString()}
							</time>
							{#if lastTwitUri}
								<span class="mt-1 block font-mono text-[10px] text-emerald-200/70">
									{lastTwitUri}
								</span>
							{/if}
						</p>
					{:else if form?.formType === 'twit' && form.twitStatus === 'error' && form.message}
						<p
							class="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
							aria-live="polite"
						>
							{form.message}
						</p>
					{/if}

					<form method="post" action="?/twit" class="mt-6 space-y-3">
						<button
							type="submit"
							disabled={isCoolingDown}
							class="inline-flex w-full items-center justify-center rounded-md bg-sky-400 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
						>
							{#if isCoolingDown}
								Cooling down… {cooldownRemainingSeconds}s
							{:else}
								Fire a twit
							{/if}
						</button>

						<p class="text-xs text-slate-500">
							A short cooldown prevents accidental rapid twiting. Each twit records your DID and a timestamp.
						</p>
					</form>
				</div>
			{:else}
				<form method="post" action="?/login" class="space-y-6 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/40">
					<div class="space-y-2">
						<label for="identifier" class="block text-sm font-medium text-slate-200">
							Handle or DID
						</label>
					<input
						type="text"
						id="identifier"
						name="identifier"
						required
						autocomplete="username"
						value={form?.formType === 'login' ? form.identifier ?? '' : ''}
						class="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-slate-950/40 focus:border-slate-200 focus:outline-none"
					/>
					</div>

					<div class="space-y-2">
						<label for="password" class="block text-sm font-medium text-slate-200">
							App password
						</label>
						<input
							type="password"
							id="password"
							name="password"
							required
							autocomplete="current-password"
							class="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-slate-950/40 focus:border-slate-200 focus:outline-none"
						/>
					</div>

					{#if form?.formType === 'login' && form.message}
						<p class="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-300">
							{form.message}
						</p>
					{/if}

					<button
						type="submit"
						class="w-full rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
					>
						Sign in
					</button>
				</form>
			{/if}
		</div>
	</section>
</main>
