import type { Handle } from '@sveltejs/kit';
import { getSessionFromCookies } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = getSessionFromCookies(event.cookies);

	return resolve(event);
};
