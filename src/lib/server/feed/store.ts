const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_BUFFER = 500;

export type TwitFeedItem = {
	authorDid: string;
	authorHandle: string;
	cid: string;
	indexedAt: string;
	recordCreatedAt: string;
	uri: string;
};

type StoredTwitFeedItem = TwitFeedItem & {
	id: number;
};

export type ListOptions = {
	cursor?: string | null;
	limit?: number;
};

export type ListResult = {
	items: TwitFeedItem[];
	nextCursor: string | null;
};

export interface TwitRepository {
	add(item: TwitFeedItem): Promise<void>;
	list(options?: ListOptions): Promise<ListResult>;
}

export interface MutableTwitRepository extends TwitRepository {
	clear(): Promise<void>;
}

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

const normalizeLimit = (limit: number | undefined): number => {
	const parsed = Number.isFinite(limit) ? Math.trunc(limit as number) : DEFAULT_LIMIT;
	return clamp(parsed || DEFAULT_LIMIT, 1, MAX_LIMIT);
};

export class InMemoryTwitRepository implements MutableTwitRepository {
	#items: StoredTwitFeedItem[] = [];
	#nextId = 1;

	async add(item: TwitFeedItem): Promise<void> {
		if (this.#items.some((existing) => existing.uri === item.uri)) {
			return;
		}

		const indexedAt = item.indexedAt ?? new Date().toISOString();
		const record: StoredTwitFeedItem = {
			...item,
			indexedAt,
			id: this.#nextId++
		};

		this.#items.unshift(record);

		if (this.#items.length > MAX_BUFFER) {
			this.#items.length = MAX_BUFFER;
		}
	}

	async list(options: ListOptions = {}): Promise<ListResult> {
		const { cursor, limit } = options;
		const normalizedLimit = normalizeLimit(limit);

		let startIndex = 0;
		if (cursor) {
			const cursorId = Number.parseInt(cursor, 10);
			if (Number.isFinite(cursorId)) {
				const cursorPosition = this.#items.findIndex((item) => item.id === cursorId);
				if (cursorPosition >= 0) {
					startIndex = cursorPosition + 1;
				} else {
					startIndex = this.#items.length;
				}
			}
		}

		const page = this.#items.slice(startIndex, startIndex + normalizedLimit);
		const nextCursor =
			page.length === normalizedLimit && startIndex + page.length < this.#items.length
				? String(page[page.length - 1].id)
				: null;

		return {
			items: page.map(({ id: _id, ...rest }) => rest),
			nextCursor
		};
	}

	async clear(): Promise<void> {
		this.#items = [];
		this.#nextId = 1;
	}
}

export const createInMemoryTwitRepository = (): MutableTwitRepository =>
	new InMemoryTwitRepository();

export const twitRepository: TwitRepository = createInMemoryTwitRepository();
