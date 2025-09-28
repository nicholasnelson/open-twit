import { Agent } from '@atproto/api';
import { redirect, type RequestHandler } from '@sveltejs/kit';

import { getOAuthClient } from '$lib/server/auth/oauth-client';
import { isOAuthEnabled } from '$lib/server/auth/oauth-config';
import { clearSessionCookie, createOAuthSessionPayload, setSessionCookie } from '$lib/server/session';

const redirectWithError = (code: string) => {
	throw redirect(303, `/?authError=${encodeURIComponent(code)}`);
};

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	if (!isOAuthEnabled()) {
		redirectWithError('oauth_disabled');
	}

	try {
		const client = getOAuthClient();
		const { session, state } = await client.callback(url.searchParams);

		const agent = new Agent(session);
		const { data } = await agent.com.atproto.server.getSession();

		const payload = createOAuthSessionPayload({
			did: data.did,
			handle: data.handle ?? data.did,
			service: session.serverMetadata.issuer
		});

		setSessionCookie(cookies, payload);
		locals.session = payload;
	} catch (error) {
		console.error('OAuth callback failed', error);
		clearSessionCookie(cookies);
		locals.session = null;
		redirectWithError('callback_failed');
	}

	throw redirect(303, '/');
};
