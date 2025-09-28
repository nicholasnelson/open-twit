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
			authorDid TEXT NOT NULL,
			authorHandle TEXT NOT NULL,
			cid TEXT NOT NULL,
			indexedAt TEXT NOT NULL,
			recordCreatedAt TEXT NOT NULL,
			uri TEXT NOT NULL UNIQUE
		);

		CREATE INDEX IF NOT EXISTS twits_indexedAt_desc ON twits (indexedAt DESC);
	`);

	return db;
};

export class SqliteTwitRepository implements MutableTwitRepository {
	#db: Database;
	#maxBuffer: number;
	#insert: Statement;
	#selectPage: Statement;
	#selectFirstPage: Statement;
	#trim: Statement;
	#clearStmt: Statement;

	constructor(options: SqliteTwitRepositoryOptions = {}) {
		const databaseFile = options.databaseFile ?? DEFAULT_DATABASE_FILE;
		const db = createDatabase(databaseFile);
		this.#db = db;
		this.#maxBuffer = options.maxBuffer ?? MAX_BUFFER_DEFAULT;

		this.#insert = db.prepare(
			`INSERT OR IGNORE INTO twits (authorDid, authorHandle, cid, indexedAt, recordCreatedAt, uri)
			VALUES (@authorDid, @authorHandle, @cid, @indexedAt, @recordCreatedAt, @uri)`
		);
		this.#selectPage = db.prepare(
			`SELECT id, authorDid, authorHandle, cid, indexedAt, recordCreatedAt, uri
			FROM twits
			WHERE id < @cursor
			ORDER BY id DESC
			LIMIT @limit`
		);
		this.#selectFirstPage = db.prepare(
			`SELECT id, authorDid, authorHandle, cid, indexedAt, recordCreatedAt, uri
			FROM twits
			ORDER BY id DESC
			LIMIT @limit`
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
			authorDid: item.authorDid,
			authorHandle: item.authorHandle,
			cid: item.cid,
			indexedAt,
			recordCreatedAt: item.recordCreatedAt,
			uri: item.uri
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
			items: rows.map(({ id: _id, ...rest }) => rest),
			nextCursor
		};
	}

	async clear(): Promise<void> {
		this.#clearStmt.run();
	}
}

export const createSqliteTwitRepository = (
	options: SqliteTwitRepositoryOptions = {}
): SqliteTwitRepository => new SqliteTwitRepository(options);
