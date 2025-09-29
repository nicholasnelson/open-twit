export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export type TwitItemType = 'twit' | 'retwit';

export type TwitFeedItem = {
	type: TwitItemType;
	authorDid: string;
	authorHandle: string;
	cid: string;
	indexedAt: string;
	recordCreatedAt: string;
	uri: string;
	resharedByDid?: string;
	resharedByHandle?: string;
	subjectUri?: string;
	subjectCid?: string;
	subjectRecordCreatedAt?: string;
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
	getByUri(uri: string): Promise<TwitFeedItem | null>;
}

export interface MutableTwitRepository extends TwitRepository {
	clear(): Promise<void>;
}

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

export const normalizeLimit = (limit: number | undefined): number => {
	const parsed = Number.isFinite(limit) ? Math.trunc(limit as number) : DEFAULT_LIMIT;
	return clamp(parsed || DEFAULT_LIMIT, 1, MAX_LIMIT);
};

export const parseCursor = (cursor: string | null | undefined): number | null => {
	if (!cursor) {
		return null;
	}

	const cursorId = Number.parseInt(cursor, 10);
	return Number.isFinite(cursorId) ? cursorId : null;
};

export const cursorFromId = (id: number | null | undefined): string | null => {
	if (typeof id !== 'number' || !Number.isFinite(id)) {
		return null;
	}

	return id > 0 ? String(id) : null;
};
