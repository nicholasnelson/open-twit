import { redirect, type RequestHandler } from '@sveltejs/kit';

import { getOAuthClient } from '$lib/server/auth/oauth-client';
import { isOAuthEnabled } from '$lib/server/auth/oauth-config';
import { OAUTH_REDIRECT_URI, OAUTH_SCOPE } from '$lib/server/env';

const parseRedirectUri = (): string | undefined =>
	OAUTH_REDIRECT_URI?.split(',')
		.map((value) => value.trim())
		.find((value) => value.length > 0);

export const GET: RequestHandler = async ({ url }) => {
	if (!isOAuthEnabled()) {
		throw redirect(303, '/?authError=oauth_disabled');
	}

	const handle = url.searchParams.get('handle')?.trim();
	if (!handle) {
		throw redirect(303, '/?authError=missing_handle');
	}

	const client = getOAuthClient();
	const redirectUri = parseRedirectUri();
	if (!redirectUri) {
		throw redirect(303, '/?authError=missing_redirect');
	}

	const authorizeUrl = await client.authorize(handle, {
		scope: OAUTH_SCOPE,
		redirect_uri: redirectUri
	});

	authorizeUrl.searchParams.set('redirect_uri', redirectUri);
	authorizeUrl.searchParams.set('scope', OAUTH_SCOPE);

	throw redirect(302, authorizeUrl.toString());
};
