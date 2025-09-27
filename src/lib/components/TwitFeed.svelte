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

<section class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-slate-100">Latest twits</h2>
		<button
			type="button"
			onclick={refreshLatest}
			disabled={isLoading}
			class="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Refresh
		</button>
	</div>

	{#if isInitialLoading}
		<div class="space-y-3">
			<div class="h-24 animate-pulse rounded-lg bg-slate-800/60"></div>
			<div class="h-24 animate-pulse rounded-lg bg-slate-800/60"></div>
		</div>
	{:else if errorMessage}
		<div class="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
			<p>{errorMessage}</p>
			<button
				type="button"
				onclick={handleRetry}
				class="mt-2 rounded-md border border-red-300/40 px-3 py-1 text-xs text-red-100 transition hover:bg-red-500/20"
			>
				Retry
			</button>
		</div>
	{:else if isEmpty}
		<p class="rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
			No twits yet. Sign in and fire the first one!
		</p>
	{:else}
		<ul class="space-y-3">
			{#each items as item (item.uri)}
				<li class="rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="text-base font-medium text-slate-100">{formatAuthor(item)}</p>
							<p class="text-xs text-slate-500">{item.author.did}</p>
						</div>
						<div class="text-right text-xs text-slate-400">
							<p>{formatRelativeTime(item.record.createdAt, currentTime)}</p>
							<p class="font-mono text-[10px] text-slate-600">{formatAbsoluteTime(item.record.createdAt)}</p>
						</div>
					</div>
					<div class="mt-3 space-y-1 text-xs text-slate-400">
						<p class="break-all font-mono text-[11px] text-slate-500">URI: {item.uri}</p>
						<p class="break-all font-mono text-[11px] text-slate-600">CID: {item.cid}</p>
					</div>
				</li>
			{/each}
		</ul>

		{#if hasMore}
			<div class="pt-2">
				<button
					type="button"
					onclick={loadMore}
					disabled={isLoadingMore}
					class="w-full rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
				>
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
