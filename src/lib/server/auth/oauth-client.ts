import { NodeOAuthClient } from '@atproto/oauth-client-node';

import { OAUTH_ALLOW_HTTP } from '../env';
import { getClientMetadata, isOAuthEnabled } from './oauth-config';
import { getSessionStore, getStateStore } from './oauth-store';

let client: NodeOAuthClient | null = null;

export const getOAuthClient = (): NodeOAuthClient => {
	if (!client) {
		if (!isOAuthEnabled()) {
			throw new Error('OAuth client requested but OAuth is not configured.');
		}

		client = new NodeOAuthClient({
			clientMetadata: getClientMetadata(),
			stateStore: getStateStore(),
			sessionStore: getSessionStore(),
			allowHttp: OAUTH_ALLOW_HTTP
		});
	}

	return client;
};
