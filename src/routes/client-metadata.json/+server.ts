import { json, type RequestHandler } from '@sveltejs/kit';

import { getClientMetadata, isOAuthEnabled } from '$lib/server/auth/oauth-config';

export const GET: RequestHandler = () => {
	if (!isOAuthEnabled()) {
		return new Response('OAuth not configured.', { status: 404 });
	}

	return json(getClientMetadata());
};
