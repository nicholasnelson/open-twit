import { twitRepository } from '$lib/server/feed/store';
import { JETSTREAM_ENABLED, JETSTREAM_ENDPOINT, JETSTREAM_INITIAL_CURSOR } from '$lib/server/env';
import {
	persistCursorImmediately,
	readPersistedCursor,
	schedulePersistCursor
} from '$lib/server/feed/cursor';
import { CommitType, Jetstream, type CommitCreateEvent } from '@skyware/jetstream';

const TWIT_COLLECTION = 'com.atweet.twit';

const handleCache = new Map<string, string>();
let startPromise: Promise<void> | null = null;
let jetstreamInstance: Jetstream | null = null;

const toIsoDate = (microseconds: number): string => {
	const milliseconds = Math.floor(microseconds / 1000);
	return new Date(milliseconds).toISOString();
};

const toStringOrFallback = (value: unknown, fallback = ''): string => {
	if (typeof value === 'string') return value;
	if (value && typeof (value as { toString: () => string }).toString === 'function') {
		return (value as { toString: () => string }).toString();
	}
	return fallback;
};

const getHandleForDid = (did: string): string => handleCache.get(did) ?? did;

const handleCreateEvent = async (event: CommitCreateEvent<typeof TWIT_COLLECTION>) => {
	const record = event.commit.record as { createdAt?: string } | undefined;
	const recordCreatedAt =
		typeof record?.createdAt === 'string' ? record.createdAt : toIsoDate(event.time_us);
	const possibleHandle = (record as { handle?: string })?.handle;
	if (possibleHandle && possibleHandle !== 'handle.invalid') {
		handleCache.set(event.did, possibleHandle);
	}
	const uri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`;
	const cid = toStringOrFallback(event.commit.cid, uri);

	try {
		await twitRepository.add({
			authorDid: event.did,
			authorHandle: getHandleForDid(event.did),
			cid,
			indexedAt: toIsoDate(event.time_us),
			recordCreatedAt,
			uri
		});
	} catch (error) {
		console.error('Failed to persist Jetstream event', { uri, error });
	}

	schedulePersistCursor(event.time_us);
};

const ensureJetstream = async (): Promise<Jetstream | null> => {
	if (!JETSTREAM_ENABLED) {
		return null;
	}

	if (jetstreamInstance) {
		return jetstreamInstance;
	}

	let cursor = JETSTREAM_INITIAL_CURSOR;
	if (typeof cursor !== 'number') {
		cursor = await readPersistedCursor();
	}

	try {
		jetstreamInstance = new Jetstream({
			endpoint: JETSTREAM_ENDPOINT,
			wantedCollections: [TWIT_COLLECTION],
			cursor
		});
	} catch (error) {
		console.error('Failed to initialize Jetstream', error);
		return null;
	}

	jetstreamInstance.on('open', () => {
		console.info('Jetstream connected', {
			endpoint: JETSTREAM_ENDPOINT,
			cursor: cursor ?? 'latest'
		});
	});

	jetstreamInstance.on('close', () => {
		console.warn('Jetstream connection closed');
	});

	jetstreamInstance.on('error', (error, currentCursor) => {
		console.error('Jetstream error', { error, cursor: currentCursor });
	});

	jetstreamInstance.on('identity', (event) => {
		const handle = event.identity.handle;
		if (handle && handle !== 'handle.invalid') {
			handleCache.set(event.identity.did, handle);
		}
	});

	jetstreamInstance.onCreate(TWIT_COLLECTION, async (event) => {
		if (event.commit.operation !== CommitType.Create) return;
		await handleCreateEvent(event);
	});

	return jetstreamInstance;
};

export const startJetstreamConsumer = (): Promise<void> => {
	if (!JETSTREAM_ENABLED) {
		return Promise.resolve();
	}

	if (!startPromise) {
		startPromise = (async () => {
			const jetstream = await ensureJetstream();
			if (!jetstream) return;

			jetstream.start();

			process.on('beforeExit', async () => {
				await persistCursorImmediately();
				jetstream.close();
			});
		})();
	}

	return startPromise;
};
