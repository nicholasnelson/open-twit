import { json, type RequestHandler } from '@sveltejs/kit';
import { twitRepository } from '$lib/server/feed/store';

const toNumberOrUndefined = (value: string | null): number | undefined => {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
};

export const GET: RequestHandler = async ({ url }) => {
	const limit = toNumberOrUndefined(url.searchParams.get('limit'));
	const cursor = url.searchParams.get('cursor') ?? undefined;

	const { items, nextCursor } = await twitRepository.list({ limit, cursor });

	return json(
		{
			cursor: nextCursor,
			items: items.map((item) => ({
				uri: item.uri,
				cid: item.cid,
				indexedAt: item.indexedAt,
				record: {
					createdAt: item.recordCreatedAt
				},
				author: {
					did: item.authorDid,
					handle: item.authorHandle
				}
			}))
		},
		{
			headers: {
				'Cache-Control': 'private, max-age=2'
			}
		}
	);
};
