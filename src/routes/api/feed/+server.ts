import { json, type RequestHandler } from '@sveltejs/kit';
import { twitRepository, type TwitItemType } from '$lib/server/feed/store';

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
			items: items.map((item) => {
				const record: {
					createdAt: string;
					subject?: { uri: string; cid: string };
					subjectCreatedAt?: string;
				} = {
					createdAt: item.recordCreatedAt
				};

				if (item.type === 'retwit' && item.subjectUri && item.subjectCid) {
					record.subject = {
						uri: item.subjectUri,
						cid: item.subjectCid
					};
					if (item.subjectRecordCreatedAt) {
						record.subjectCreatedAt = item.subjectRecordCreatedAt;
					}
				}

				const responseItem: {
					type: TwitItemType;
					uri: string;
					cid: string;
					indexedAt: string;
					record: typeof record;
					author: { did: string; handle: string };
					resharedBy?: { did: string; handle: string };
				} = {
					type: item.type,
					uri: item.uri,
					cid: item.cid,
					indexedAt: item.indexedAt,
					record,
					author: {
						did: item.authorDid,
						handle: item.authorHandle
					}
				};

				if (item.type === 'retwit' && item.resharedByDid) {
					responseItem.resharedBy = {
						did: item.resharedByDid,
						handle: item.resharedByHandle ?? item.resharedByDid
					};
				}

				return responseItem;
			})
		},
		{
			headers: {
				'Cache-Control': 'private, max-age=2'
			}
		}
	);
};
