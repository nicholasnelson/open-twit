import type { TwitRepository } from './repository';
import { createInMemoryTwitRepository } from './in-memory-twit-repository';
import { createSqliteTwitRepository } from './sqlite-twit-repository';

export {
	DEFAULT_LIMIT,
	MAX_LIMIT,
	cursorFromId,
	normalizeLimit,
	parseCursor,
	type ListOptions,
	type ListResult,
	type MutableTwitRepository,
	type TwitFeedItem,
	type TwitRepository
} from './repository';

export {
	InMemoryTwitRepository,
	createInMemoryTwitRepository
} from './in-memory-twit-repository';

export {
	SqliteTwitRepository,
	createSqliteTwitRepository
} from './sqlite-twit-repository';

const createDefaultRepository = (): TwitRepository => {
	const driver = process.env.TWIT_REPOSITORY_DRIVER?.toLowerCase();

	switch (driver) {
		case 'memory':
			return createInMemoryTwitRepository();
		case 'sqlite':
		case 'file':
		case undefined:
		default:
			return createSqliteTwitRepository();
	}
};

export const twitRepository: TwitRepository = createDefaultRepository();
