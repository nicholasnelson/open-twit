import Database from 'better-sqlite3';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

import type { SimpleStore } from '@atproto-labs/simple-store';
import type {
	NodeSavedSession,
	NodeSavedSessionStore,
	NodeSavedState,
	NodeSavedStateStore
} from '@atproto/oauth-client-node';

import { OAUTH_STORE_FILE } from '../env';

const ensureDirectory = (filePath: string): void => {
	const directory = dirname(filePath);
	if (!existsSync(directory)) {
		mkdirSync(directory, { recursive: true });
	}
};

const createDatabase = (filePath: string) => {
	const location = resolvePath(process.cwd(), filePath);
	ensureDirectory(location);

	const db = new Database(location);

	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS oauth_states (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH()),
			updated_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
		);

		CREATE TABLE IF NOT EXISTS oauth_sessions (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH()),
			updated_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
		);
	`);

	return db;
};

type SqliteDatabase = ReturnType<typeof createDatabase>;

type Row = {
	value: string;
};

type JsonStoreValue = NodeSavedState | NodeSavedSession;

const serialize = (value: JsonStoreValue): string => JSON.stringify(value);

const deserialize = <T extends JsonStoreValue>(value: string): T => {
	return JSON.parse(value) as T;
};

class SqliteStore<V extends JsonStoreValue> implements SimpleStore<string, V> {
	#db: SqliteDatabase;
	#table: 'oauth_states' | 'oauth_sessions';
	#setStatement: any;
	#getStatement: any;
	#deleteStatement: any;
	#clearStatement: any;

	constructor(db: SqliteDatabase, table: 'oauth_states' | 'oauth_sessions') {
		this.#db = db;
		this.#table = table;
		this.#setStatement = db.prepare(
			`INSERT INTO ${table} (key, value, created_at, updated_at)
			 VALUES (@key, @value, UNIXEPOCH(), UNIXEPOCH())
			 ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
		);
		this.#getStatement = db.prepare<Row>(`SELECT value FROM ${table} WHERE key = ?`);
		this.#deleteStatement = db.prepare(`DELETE FROM ${table} WHERE key = ?`);
		this.#clearStatement = db.prepare(`DELETE FROM ${table}`);
	}

	async get(key: string): Promise<V | undefined> {
		const row = this.#getStatement.get(key);
		if (!row) return undefined;
		return deserialize<V>(row.value);
	}

	async set(key: string, value: V): Promise<void> {
		this.#setStatement.run({ key, value: serialize(value) });
	}

	async del(key: string): Promise<void> {
		this.#deleteStatement.run(key);
	}

	async clear(): Promise<void> {
		this.#clearStatement.run();
	}
}

let database: SqliteDatabase | null = null;
let stateStore: NodeSavedStateStore | null = null;
let sessionStore: NodeSavedSessionStore | null = null;

const getDatabase = (): SqliteDatabase => {
	if (!database) {
		database = createDatabase(OAUTH_STORE_FILE);
	}
	return database;
};

export const getStateStore = (): NodeSavedStateStore => {
	if (!stateStore) {
		stateStore = new SqliteStore<NodeSavedState>(getDatabase(), 'oauth_states');
	}
	return stateStore;
};

export const getSessionStore = (): NodeSavedSessionStore => {
	if (!sessionStore) {
		sessionStore = new SqliteStore<NodeSavedSession>(getDatabase(), 'oauth_sessions');
	}
	return sessionStore;
};

export const resetStoresForTesting = (): void => {
	if (stateStore) {
		void stateStore.clear?.();
	}
	if (sessionStore) {
		void sessionStore.clear?.();
	}
};
