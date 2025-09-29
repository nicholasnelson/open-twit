import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';
import type { Statement } from 'better-sqlite3';

import {
	cursorFromId,
	normalizeLimit,
	parseCursor,
	type ListOptions,
	type ListResult,
	type MutableTwitRepository,
	type TwitFeedItem
} from './repository';

const MAX_BUFFER_DEFAULT = 500;
const DEFAULT_DATABASE_FILE = process.env.TWIT_REPOSITORY_FILE ?? '.data/twits.sqlite';

export type SqliteTwitRepositoryOptions = {
	databaseFile?: string;
	maxBuffer?: number;
};

const ensureDirectoryExists = (filePath: string): void => {
	const directory = dirname(filePath);
	if (!directory || directory === '.' || existsSync(directory)) {
		return;
	}

	mkdirSync(directory, { recursive: true });
};

const createDatabase = (filePath: string): Database => {
	ensureDirectoryExists(filePath);
	const db = new Database(filePath);

	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS twits (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL DEFAULT 'twit',
			authorDid TEXT NOT NULL,
			authorHandle TEXT NOT NULL,
			cid TEXT NOT NULL,
			indexedAt TEXT NOT NULL,
			recordCreatedAt TEXT NOT NULL,
			uri TEXT NOT NULL UNIQUE,
			resharedByDid TEXT,
			resharedByHandle TEXT,
			subjectUri TEXT,
			subjectCid TEXT,
			subjectRecordCreatedAt TEXT
		);

		CREATE INDEX IF NOT EXISTS twits_indexedAt_desc ON twits (indexedAt DESC);
	`);

	const columnMigrations: Array<{ name: string; definition: string }> = [
		{ name: 'type', definition: "ADD COLUMN type TEXT NOT NULL DEFAULT 'twit'" },
		{ name: 'resharedByDid', definition: 'ADD COLUMN resharedByDid TEXT' },
		{ name: 'resharedByHandle', definition: 'ADD COLUMN resharedByHandle TEXT' },
		{ name: 'subjectUri', definition: 'ADD COLUMN subjectUri TEXT' },
		{ name: 'subjectCid', definition: 'ADD COLUMN subjectCid TEXT' },
		{ name: 'subjectRecordCreatedAt', definition: 'ADD COLUMN subjectRecordCreatedAt TEXT' }
	];

	try {
		const existingColumns = new Set(
			db.prepare('PRAGMA table_info(twits)').all().map((column) => column.name as string)
		);
		for (const { name, definition } of columnMigrations) {
			if (existingColumns.has(name)) continue;
			try {
				db.prepare(`ALTER TABLE twits ${definition}`).run();
				existingColumns.add(name);
			} catch (error) {
				console.warn(`Failed to ensure column ${name} on twits table`, error);
			}
		}
	} catch (error) {
		console.warn('Failed to inspect twits table schema', error);
	}

	return db;
};

export class SqliteTwitRepository implements MutableTwitRepository {
	#db: Database;
	#maxBuffer: number;
	#insert: Statement;
	#selectPage: Statement;
	#selectFirstPage: Statement;
	#selectByUri: Statement;
	#trim: Statement;
	#clearStmt: Statement;

	constructor(options: SqliteTwitRepositoryOptions = {}) {
		const databaseFile = options.databaseFile ?? DEFAULT_DATABASE_FILE;
		const db = createDatabase(databaseFile);
		this.#db = db;
		this.#maxBuffer = options.maxBuffer ?? MAX_BUFFER_DEFAULT;

		this.#insert = db.prepare(
			`INSERT OR IGNORE INTO twits (
				type,
				authorDid,
				authorHandle,
				cid,
				indexedAt,
				recordCreatedAt,
				uri,
				resharedByDid,
				resharedByHandle,
				subjectUri,
				subjectCid,
				subjectRecordCreatedAt
			)
			VALUES (
				@type,
				@authorDid,
				@authorHandle,
				@cid,
				@indexedAt,
				@recordCreatedAt,
				@uri,
				@resharedByDid,
				@resharedByHandle,
				@subjectUri,
				@subjectCid,
				@subjectRecordCreatedAt
			)`
		);
		this.#selectPage = db.prepare(
			`SELECT id, type, authorDid, authorHandle, cid, indexedAt, recordCreatedAt, uri, resharedByDid, resharedByHandle, subjectUri, subjectCid, subjectRecordCreatedAt
			FROM twits
			WHERE id < @cursor
			ORDER BY id DESC
			LIMIT @limit`
		);
		this.#selectFirstPage = db.prepare(
			`SELECT id, type, authorDid, authorHandle, cid, indexedAt, recordCreatedAt, uri, resharedByDid, resharedByHandle, subjectUri, subjectCid, subjectRecordCreatedAt
			FROM twits
			ORDER BY id DESC
			LIMIT @limit`
		);
		this.#selectByUri = db.prepare(
			`SELECT id, type, authorDid, authorHandle, cid, indexedAt, recordCreatedAt, uri, resharedByDid, resharedByHandle, subjectUri, subjectCid, subjectRecordCreatedAt
			FROM twits
			WHERE uri = @uri
			LIMIT 1`
		);
		this.#trim = db.prepare(
			`DELETE FROM twits
			WHERE id NOT IN (
				SELECT id FROM twits
				ORDER BY id DESC
				LIMIT @limit
			)`
		);
		this.#clearStmt = db.prepare('DELETE FROM twits');
	}

	async add(item: TwitFeedItem): Promise<void> {
		const indexedAt = item.indexedAt ?? new Date().toISOString();

		const result = this.#insert.run({
			type: item.type,
			authorDid: item.authorDid,
			authorHandle: item.authorHandle,
			cid: item.cid,
			indexedAt,
			recordCreatedAt: item.recordCreatedAt,
			uri: item.uri,
			resharedByDid: item.resharedByDid ?? null,
			resharedByHandle: item.resharedByHandle ?? null,
			subjectUri: item.subjectUri ?? null,
			subjectCid: item.subjectCid ?? null,
			subjectRecordCreatedAt: item.subjectRecordCreatedAt ?? null
		});

		if (result.changes === 0) {
			return;
		}

		this.#trim.run({ limit: this.#maxBuffer });
	}

	async list(options: ListOptions = {}): Promise<ListResult> {
		const normalizedLimit = normalizeLimit(options.limit);
		const cursorId = parseCursor(options.cursor);

		const rows = cursorId !== null
			? this.#selectPage.all({ cursor: cursorId, limit: normalizedLimit })
			: this.#selectFirstPage.all({ limit: normalizedLimit });

		const nextCursor =
			rows.length === normalizedLimit
				? cursorFromId(rows[rows.length - 1]?.id ?? null)
				: null;

		return {
			items: rows.map(({ id: _id, ...rest }) => rest as TwitFeedItem),
			nextCursor
		};
	}

	async clear(): Promise<void> {
		this.#clearStmt.run();
	}

	async getByUri(uri: string): Promise<TwitFeedItem | null> {
		const row = this.#selectByUri.get({ uri }) as
			| (TwitFeedItem & { id: number })
			| undefined;
		if (!row) return null;
		const { id: _id, ...rest } = row;
		return rest;
	}
}

export const createSqliteTwitRepository = (
	options: SqliteTwitRepositoryOptions = {}
): SqliteTwitRepository => new SqliteTwitRepository(options);
