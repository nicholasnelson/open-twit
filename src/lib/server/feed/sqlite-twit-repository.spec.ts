import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SqliteTwitRepository } from './sqlite-twit-repository';
import type { TwitFeedItem } from './repository';

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

describe('SqliteTwitRepository', () => {
	let tempDir: string;
	const cleanupDirs: string[] = [];

	const createRepository = () =>
		new SqliteTwitRepository({
			databaseFile: join(tempDir, 'twits.sqlite'),
			maxBuffer: 10
		});

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'twit-sqlite-'));
		cleanupDirs.push(tempDir);
	});

	afterEach(() => {
		while (cleanupDirs.length) {
			const dir = cleanupDirs.pop();
			if (dir) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	it('persists entries between instances', async () => {
		const repository = createRepository();
		const entry = createItem({ uri: 'at://did:plc:test/com.atweet.twit/1' });

		await repository.add(entry);

		const reloaded = createRepository();
		const { items } = await reloaded.list();

		expect(items).toHaveLength(1);
		expect(items[0].uri).toBe(entry.uri);
	});

	it('paginates newest-first and deduplicates by uri', async () => {
		const repository = createRepository();

		const entries = Array.from({ length: 4 }, (_, index) =>
			createItem({
				indexedAt: new Date(Date.UTC(2024, 0, index + 1)).toISOString(),
				recordCreatedAt: new Date(Date.UTC(2024, 0, index + 1, 0, 0, 1)).toISOString(),
				cid: `cid-${index}`,
				uri: `at://did:plc:test/app.bsky.feed.post/${index}`
			})
		);

		for (const entry of entries) {
			await repository.add(entry);
		}

		await repository.add({ ...entries[0], cid: 'duplicate-cid' });

		const firstPage = await repository.list({ limit: 2 });
		expect(firstPage.items).toHaveLength(2);
		expect(firstPage.items[0].cid).toBe('cid-3');
		expect(firstPage.items[1].cid).toBe('cid-2');
		expect(firstPage.nextCursor).not.toBeNull();

		const secondPage = await repository.list({ limit: 2, cursor: firstPage.nextCursor ?? undefined });
		expect(secondPage.items).toHaveLength(2);
		expect(secondPage.items[0].cid).toBe('cid-1');
		expect(secondPage.items[1].cid).toBe('cid-0');
		expect(secondPage.nextCursor).not.toBeNull();

		const emptyPage = await repository.list({ cursor: secondPage.nextCursor ?? undefined });
		expect(emptyPage.items).toHaveLength(0);
		expect(emptyPage.nextCursor).toBeNull();
	});
});
