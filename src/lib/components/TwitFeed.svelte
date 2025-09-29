<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
import { formatAbsoluteTime, formatRelativeTime } from '$lib/utils/datetime';
import RecycleIcon from './RecycleIcon.svelte';
import AvatarBadge from './AvatarBadge.svelte';

	type ReshareMetadata = {
		did: string;
		handle: string;
	};

	type FeedItem = {
		type: 'twit' | 'retwit';
		uri: string;
		cid: string;
		indexedAt: string;
		record: {
			createdAt: string;
			subject?: {
				uri: string;
				cid: string;
			};
			subjectCreatedAt?: string;
		};
		author: {
			did: string;
			handle: string;
		};
		resharedBy?: ReshareMetadata;
	};

type FeedResponse = {
	cursor: string | null;
	items: FeedItem[];
};

const props = $props<{ canRetwit?: boolean; isCoolingDown?: boolean }>();
const canRetwit = $derived(Boolean(props.canRetwit));
const parentCooldownActive = $derived(Boolean(props.isCoolingDown));

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 5000;
const CLOCK_TICK_MS = 60000;

let items = $state<FeedItem[]>([]);
	let nextCursor = $state<string | null>(null);
	let isInitialLoading = $state(true);
	let isLoadingMore = $state(false);
let errorMessage = $state<string | null>(null);
let now = $state(Date.now());
let pendingRetwitTarget = $state<string | null>(null);

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

const formatHandle = (value: { handle: string; did: string }): string =>
	value.handle || value.did;

const getContentCreatedAt = (item: FeedItem): string =>
	item.type === 'retwit'
		? item.record.subjectCreatedAt ?? item.record.createdAt
		: item.record.createdAt;

const getRetwitTarget = (item: FeedItem): { uri: string; cid: string } | null => {
	if (item.type === 'retwit') {
		if (!item.record.subject) return null;
		return {
			uri: item.record.subject.uri,
			cid: item.record.subject.cid
		};
	}
	return { uri: item.uri, cid: item.cid };
};

const isRetwitDisabled = (item: FeedItem): boolean => {
	if (!canRetwit) return true;
	const target = getRetwitTarget(item);
	if (!target) return true;
	if (parentCooldownActive) return true;
	return pendingRetwitTarget === target.uri;
};

const retwitEnhancer = (node: HTMLFormElement, item: FeedItem) =>
	enhance(node, () => {
		const target = getRetwitTarget(item);
		pendingRetwitTarget = target?.uri ?? null;
		return ({ update }) => {
			pendingRetwitTarget = null;
			if (typeof update === 'function') {
				update();
			}
		};
	});
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
		<ul class="space-y-4">
			{#each items as item, index (item.uri)}
				{@const retwitTarget = getRetwitTarget(item)}
				<li class="flex items-start gap-3 px-2 py-3 text-left text-sm text-slate-200">
					<AvatarBadge handle={formatHandle(item.author)} did={item.author.did} />
					<div class="flex-1 space-y-2">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<p class="font-semibold text-slate-100 leading-tight">
								{#if item.type === 'retwit'}
									<span>@{formatHandle(item.resharedBy ?? { handle: item.author.handle, did: item.author.did })}</span>
									<span class="font-normal text-slate-400"> retwitted </span>
									<span>@{formatHandle(item.author)}</span>
								{:else}
									<span>@{formatHandle(item.author)}</span>
									<span class="font-normal text-slate-400"> twitted!</span>
								{/if}
							</p>
							<time class="text-xs text-slate-500" title={formatAbsoluteTime(getContentCreatedAt(item))}>
								{formatRelativeTime(getContentCreatedAt(item), currentTime)}
							</time>
						</div>

						{#if canRetwit && retwitTarget}
							<form method="post" action="?/retwit" use:retwitEnhancer={item} class="inline-flex items-center gap-2 text-xs text-slate-400">
								<input type="hidden" name="uri" value={retwitTarget.uri} />
								<input type="hidden" name="cid" value={retwitTarget.cid} />
								<button
									type="submit"
									class="flex h-6 w-6 items-center justify-center text-slate-300 transition hover:text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-40"
									disabled={isRetwitDisabled(item)}
									title={pendingRetwitTarget === retwitTarget.uri || parentCooldownActive ? 'Retwit cooling down' : `Retwit ${formatHandle(item.author)}`}
								>
									<span class="sr-only">
										{pendingRetwitTarget === retwitTarget.uri || parentCooldownActive
										? `Retwit cooling down`
										: `Retwit ${formatHandle(item.author)}`}
									</span>
									<RecycleIcon className="h-3.5 w-3.5" />
								</button>
							</form>
						{/if}
					</div>
				</li>
				{#if index < items.length - 1}
					<li aria-hidden="true" class="px-2">
						<hr class="border-slate-800/70" />
					</li>
				{/if}
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
