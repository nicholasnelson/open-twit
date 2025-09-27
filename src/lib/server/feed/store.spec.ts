import { describe, expect, it, beforeEach } from 'vitest';
import { createInMemoryTwitRepository, type TwitFeedItem } from './store';

const createItem = (overrides: Partial<TwitFeedItem> = {}): TwitFeedItem => ({
	authorDid: overrides.authorDid ?? 'did:plc:test',
	authorHandle: overrides.authorHandle ?? 'test.handle',
	cid: overrides.cid ?? `cid-${Math.random().toString(36).slice(2)}`,
	indexedAt: overrides.indexedAt ?? new Date().toISOString(),
	recordCreatedAt: overrides.recordCreatedAt ?? new Date().toISOString(),
	uri:
		overrides.uri ??
		`at://did:plc:test/app.bsky.feed.post/${Math.random().toString(36).slice(2)}`
});

	describe('InMemoryTwitRepository', () => {
	const store = createInMemoryTwitRepository();

	beforeEach(async () => {
		await store.clear();
	});

	it('returns most recent items first with default pagination', async () => {
		const first = createItem({ indexedAt: '2024-01-01T00:00:00.000Z' });
		const second = createItem({ indexedAt: '2024-01-02T00:00:00.000Z' });
		await store.add(first);
		await store.add(second);

		const { items, nextCursor } = await store.list();

		expect(items).toHaveLength(2);
		expect(items[0].indexedAt).toBe(second.indexedAt);
		expect(items[1].indexedAt).toBe(first.indexedAt);
		expect(nextCursor).toBeNull();
	});

	it('paginates with cursor offsets', async () => {
		const entries = Array.from({ length: 5 }, (_, index) =>
			createItem({
				indexedAt: new Date(Date.UTC(2024, 0, index + 1)).toISOString(),
				recordCreatedAt: new Date(Date.UTC(2024, 0, index + 1, 0, 0, 1)).toISOString(),
				cid: `cid-${index}`,
				uri: `at://did:plc:test/app.bsky.feed.post/${index}`
			})
		);

		for (const entry of entries) {
			await store.add(entry);
		}

		const firstPage = await store.list({ limit: 2 });
		expect(firstPage.items).toHaveLength(2);
		expect(firstPage.items[0].cid).toBe('cid-4');
		expect(firstPage.items[1].cid).toBe('cid-3');
		expect(firstPage.nextCursor).not.toBeNull();

		const secondPage = await store.list({ limit: 2, cursor: firstPage.nextCursor ?? undefined });
		expect(secondPage.items).toHaveLength(2);
		expect(secondPage.items[0].cid).toBe('cid-2');
		expect(secondPage.items[1].cid).toBe('cid-1');
		expect(secondPage.nextCursor).not.toBeNull();

		const finalPage = await store.list({ limit: 2, cursor: secondPage.nextCursor ?? undefined });
		expect(finalPage.items).toHaveLength(1);
		expect(finalPage.items[0].cid).toBe('cid-0');
		expect(finalPage.nextCursor).toBeNull();
	});

	it('deduplicates entries by uri', async () => {
		const entry = createItem({ uri: 'at://did:plc:test/com.atweet.twit/abc' });
		await store.add(entry);
		await store.add({ ...entry, cid: 'another-cid' });

		const { items } = await store.list();
		expect(items).toHaveLength(1);
		expect(items[0].cid).toBe(entry.cid);
	});
});
