import { page } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TwitFeed from './TwitFeed.svelte';

type FeedItem = Record<string, unknown>;

let feedItems: FeedItem[] = [];

const buildFeedResponse = () =>
	new Response(JSON.stringify({ cursor: null, items: feedItems }), {
		headers: { 'Content-Type': 'application/json' }
	});

beforeEach(() => {
	feedItems = [];
	vi.useFakeTimers();
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
		if (typeof input === 'string' && input.startsWith('/api/feed')) {
			return buildFeedResponse();
		}

		console.warn('Unexpected fetch during TwitFeed test', input);
		return new Response('', { status: 404 });
	});
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('TwitFeed', () => {
	it('renders retwit metadata and action button when allowed', async () => {
		feedItems = [
			{
				type: 'retwit',
				uri: 'at://did:plc:reshare/com.atweet.retwit/1',
				cid: 'retwit-cid',
				indexedAt: '2024-01-01T00:00:05.000Z',
				record: {
					createdAt: '2024-01-01T00:00:05.000Z',
					subject: {
						uri: 'at://did:plc:original/com.atweet.twit/abc',
						cid: 'orig-cid'
					},
					subjectCreatedAt: '2024-01-01T00:00:00.000Z'
				},
				author: {
					did: 'did:plc:original',
					handle: 'original.handle'
				},
				resharedBy: {
					did: 'did:plc:reshare',
					handle: 'reshare.handle'
				}
			}
		];

		render(TwitFeed, { canRetwit: true, isCoolingDown: false });

		const retwitLabel = page.getByText(/@reshare\.handle retwitted @original\.handle/);
		await expect.element(retwitLabel).toBeInTheDocument();

		const retwitButton = page.getByRole('button', { name: 'Retwit original.handle' });
		await expect.element(retwitButton).toBeInTheDocument();
	});

	it('hides retwit button when user cannot retwit', async () => {
		feedItems = [
			{
				type: 'twit',
				uri: 'at://did:plc:original/com.atweet.twit/1',
				cid: 'orig-cid',
				indexedAt: '2024-01-01T00:00:00.000Z',
				record: {
					createdAt: '2024-01-01T00:00:00.000Z'
				},
				author: {
					did: 'did:plc:original',
					handle: 'original.handle'
				}
			}
		];

		render(TwitFeed, { canRetwit: false, isCoolingDown: false });

		const retwitButtonCount = Array.from(document.querySelectorAll('button')).filter((button) =>
			button.textContent?.includes('Retwit')
		).length;

		expect(retwitButtonCount).toBe(0);
	});
});
