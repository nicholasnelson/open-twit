import type { Handle } from '@sveltejs/kit';
import { getSessionFromCookies } from '$lib/server/session';
import { startJetstreamConsumer } from '$lib/server/feed/jetstream';

void startJetstreamConsumer().catch((error) => {
	console.error('Failed to start Jetstream consumer', error);
});

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = getSessionFromCookies(event.cookies);

	return resolve(event);
};
