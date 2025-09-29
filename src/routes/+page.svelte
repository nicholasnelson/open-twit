<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import TwitFeed from '$lib/components/TwitFeed.svelte';
	import LoginPanel from '$lib/components/LoginPanel.svelte';
	import type { Session } from '$lib/server/session';

	type PageData = {
		session: Session | null;
		authError?: string | null;
		authHandle?: string;
	};

type TwitFormState = {
	formType: 'twit';
	message?: string;
	twitStatus?: 'success' | 'error';
	twitTimestamp?: string;
	cooldownExpiresAt?: string;
	twitUri?: string;
};

type RetwitFormState = {
	formType: 'retwit';
	message?: string;
	retwitStatus?: 'success' | 'error';
	cooldownExpiresAt?: string;
	retwitUri?: string;
	subjectUri?: string;
};

type FormState = TwitFormState | RetwitFormState | null;

	let { data, form } = $props<{ data: PageData; form?: FormState }>();

	let showLoginPanel = $state(false);
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
	if (form?.cooldownExpiresAt) {
		cooldownExpiresAt = form.cooldownExpiresAt;
	}
});

	$effect(() => {
		if (!data.session && data.authError) {
			showLoginPanel = true;
		}
	});

	const handleTwitIntent = () => {
		if (!data.session) {
			showLoginPanel = true;
		}
	};

	const closeLoginPanel = () => {
		showLoginPanel = false;
	};

const hasActionFeedback = $derived(
	Boolean(form?.message && form.message.length > 0)
);
</script>

<main class="min-h-screen">
	<header class="sticky top-0 z-4">
		<div class="mx-auto flex w-full items-center justify-end px-6 py-4">
			{#if data.session}
				<form method="post" action="?/logout">
					<button type="submit" class="button-secondary text-xs">Log out</button>
				</form>
			{:else}
				<button type="button" class="button-secondary text-xs" onclick={() => (showLoginPanel = !showLoginPanel)}>
					Log in
				</button>
			{/if}
		</div>
	</header>

	<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
		<section class="flex flex-col items-center gap-4">
			{#if data.session}
				<form method="post" action="?/twit" class="w-full max-w-sm">
					<button type="submit" class="button-primary w-full text-lg font-semibold" disabled={isCoolingDown}>
						TWIT
					</button>
				</form>
			{:else}
				<button type="button" class="button-primary w-full max-w-sm text-lg font-semibold" onclick={handleTwitIntent}>
					TWIT
				</button>
			{/if}

		{#if hasActionFeedback}
			<p class="text-sm text-slate-300" aria-live="polite">{form?.message}</p>
		{:else if isCoolingDown}
			<p class="text-xs text-slate-400" aria-live="polite">Cooldown active… {cooldownRemainingSeconds}s</p>
		{/if}
		</section>

		{#if !data.session && showLoginPanel}
			<LoginPanel authHandle={data.authHandle} authError={data.authError} onClose={closeLoginPanel} />
		{/if}

		<section>
			<TwitFeed canRetwit={Boolean(data.session)} isCoolingDown={isCoolingDown} />
		</section>
	</div>
</main>
