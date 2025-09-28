import {
	cursorFromId,
	normalizeLimit,
	parseCursor,
	type ListOptions,
	type ListResult,
	type MutableTwitRepository,
	type TwitFeedItem
} from './repository';

const MAX_BUFFER = 500;

type StoredTwitFeedItem = TwitFeedItem & {
	id: number;
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
		const cursorId = parseCursor(cursor ?? null);

		if (cursorId !== null) {
			const cursorPosition = this.#items.findIndex((item) => item.id === cursorId);
			startIndex = cursorPosition >= 0 ? cursorPosition + 1 : this.#items.length;
		}

		const page = this.#items.slice(startIndex, startIndex + normalizedLimit);
		const nextCursor =
			page.length === normalizedLimit && startIndex + page.length < this.#items.length
				? cursorFromId(page[page.length - 1].id)
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
