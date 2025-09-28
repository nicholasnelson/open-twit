import type { OAuthClientMetadataInput } from '@atproto/oauth-client';

import {
	OAUTH_CLIENT_ID,
	OAUTH_CLIENT_NAME,
	OAUTH_CLIENT_URI,
	OAUTH_ENABLED,
	OAUTH_LOGO_URI,
	OAUTH_POLICY_URI,
	OAUTH_REDIRECT_URI,
	OAUTH_SCOPE,
	OAUTH_TOS_URI
} from '../env';

const parseRedirectUris = (value: string | null): string[] => {
	if (!value) return [];
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
};

export const getClientMetadata = (): OAuthClientMetadataInput => {
	if (!OAUTH_ENABLED || !OAUTH_CLIENT_ID || !OAUTH_REDIRECT_URI) {
		throw new Error('OAuth client configuration is incomplete.');
	}

	const redirectUris = parseRedirectUris(OAUTH_REDIRECT_URI);
	if (redirectUris.length === 0) {
		throw new Error('At least one OAuth redirect URI must be configured.');
	}

	return {
		client_id: OAUTH_CLIENT_ID,
		client_name: OAUTH_CLIENT_NAME ?? 'atweet',
		client_uri: OAUTH_CLIENT_URI ?? undefined,
		logo_uri: OAUTH_LOGO_URI ?? undefined,
		policy_uri: OAUTH_POLICY_URI ?? undefined,
		tos_uri: OAUTH_TOS_URI ?? undefined,
		redirect_uris: redirectUris,
		response_types: ['code'],
		grant_types: ['authorization_code', 'refresh_token'],
		scope: OAUTH_SCOPE,
		application_type: 'web',
		token_endpoint_auth_method: 'none'
	};
};

export const isOAuthEnabled = (): boolean => OAUTH_ENABLED;
