<script lang="ts">
	import { onMount } from 'svelte';
	import { formatAbsoluteTime, formatRelativeTime } from '$lib/utils/datetime';

	type FeedItem = {
		uri: string;
		cid: string;
		indexedAt: string;
		record: {
			createdAt: string;
		};
		author: {
			did: string;
			handle: string;
		};
	};

	type FeedResponse = {
		cursor: string | null;
		items: FeedItem[];
	};

	const PAGE_SIZE = 20;
	const REFRESH_INTERVAL_MS = 5000;
	const CLOCK_TICK_MS = 60000;

	let items = $state<FeedItem[]>([]);
	let nextCursor = $state<string | null>(null);
	let isInitialLoading = $state(true);
	let isLoadingMore = $state(false);
	let errorMessage = $state<string | null>(null);
	let now = $state(Date.now());

	const isEmpty = $derived(!isInitialLoading && items.length === 0);
	const hasMore = $derived(Boolean(nextCursor));
	const isLoading = $derived(isInitialLoading || isLoadingMore);

	let refreshTimer: ReturnType<typeof setInterval> | undefined;
	let clockTimer: ReturnType<typeof setInterval> | undefined;

	const buildUrl = (cursor?: string | null): string => {
		const params = new URLSearchParams();
		params.set('limit', String(PAGE_SIZE));
		if (cursor) params.set('cursor', cursor);
		return `/api/feed?${params.toString()}`;
	};

	const dedupeItems = (existing: FeedItem[], incoming: FeedItem[]): FeedItem[] => {
		const seen = new Set(existing.map((item) => item.uri));
		const merged = [...existing];
		for (const item of incoming) {
			if (!seen.has(item.uri)) {
				merged.push(item);
				seen.add(item.uri);
			}
		}

		return merged;
	};

	const loadInitial = async () => {
		isInitialLoading = true;
		errorMessage = null;

		try {
			const response = await fetch(buildUrl());
			if (!response.ok) throw new Error(`Request failed with ${response.status}`);
			const payload = (await response.json()) as FeedResponse;
			items = payload.items;
			nextCursor = payload.cursor;
		} catch (error) {
			console.error('Failed to load feed', error);
			errorMessage = 'Unable to load the feed. Please try again.';
		} finally {
			isInitialLoading = false;
		}
	};

	const loadMore = async () => {
		if (!nextCursor || isLoadingMore) return;

		isLoadingMore = true;
		errorMessage = null;

		try {
			const response = await fetch(buildUrl(nextCursor));
			if (!response.ok) throw new Error(`Request failed with ${response.status}`);
			const payload = (await response.json()) as FeedResponse;
			items = dedupeItems(items, payload.items);
			nextCursor = payload.cursor;
		} catch (error) {
			console.error('Failed to load more feed items', error);
			errorMessage = 'Unable to load more items. Please try again.';
		} finally {
			isLoadingMore = false;
		}
	};

	const refreshLatest = async () => {
		if (isInitialLoading || isLoadingMore) return;

		try {
			const response = await fetch(buildUrl());
			if (!response.ok) throw new Error(`Request failed with ${response.status}`);
			const payload = (await response.json()) as FeedResponse;
			if (payload.items.length === 0) return;

			const existingUris = new Set(items.map((item) => item.uri));
			const newItems = payload.items.filter((item) => !existingUris.has(item.uri));
			if (newItems.length > 0) {
				items = [...newItems, ...items];
			}
			nextCursor = nextCursor ?? payload.cursor;
		} catch (error) {
			console.error('Failed to refresh feed', error);
		}
	};

	onMount(() => {
		console.log("Mounted");
		loadInitial();

		refreshTimer = setInterval(refreshLatest, REFRESH_INTERVAL_MS);
		clockTimer = setInterval(() => {
			now = Date.now();
		}, CLOCK_TICK_MS);

		return () => {
			if (refreshTimer) clearInterval(refreshTimer);
			if (clockTimer) clearInterval(clockTimer);
		};
	});

	const handleRetry = () => {
		loadInitial();
	};

	const currentTime = $derived(new Date(now));

	const formatAuthor = (item: FeedItem): string => item.author.handle || item.author.did;
</script>

<section class="surface-card mx-auto w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="sr-only">Timeline</h2>
	</div>

	{#if isInitialLoading}
		<div class="space-y-4">
			<div class="h-24 animate-pulse rounded-xl bg-slate-800/50"></div>
			<div class="h-24 animate-pulse rounded-xl bg-slate-800/50"></div>
		</div>
	{:else if errorMessage}
		<div class="rounded-xl border border-red-500/40 bg-red-500/15 p-5 text-sm text-red-200">
			<p>{errorMessage}</p>
			<button type="button" onclick={handleRetry} class="button-secondary mt-3 px-4 py-2 text-xs">
				Retry
			</button>
		</div>
	{:else if isEmpty}
		<div class="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
			No twits yet—be the first to spark the timeline.
		</div>
	{:else}
		<ul class="space-y-3">
			{#each items as item (item.uri)}
				<li class="flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-5 text-center text-sm text-slate-200">
					<span class="font-semibold text-slate-100">@{formatAuthor(item)} <span class="font-normal text-slate-400">twitted!</span></span>
					<span class="text-xs text-slate-500">{formatRelativeTime(item.record.createdAt, currentTime)}</span>
				</li>
			{/each}
		</ul>

		{#if hasMore}
			<div class="pt-2">
				<button type="button" onclick={loadMore} disabled={isLoadingMore} class="button-secondary w-full">
					{#if isLoadingMore}
						Loading…
					{:else}
						Load more
					{/if}
				</button>
			</div>
		{/if}
	{/if}
</section>
