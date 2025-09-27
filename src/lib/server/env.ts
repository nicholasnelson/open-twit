import { env } from '$env/dynamic/private';

const DEFAULT_PDS_URL = 'https://bsky.social';

const sanitizeUrl = (value: string): string => {
	try {
		const normalized = new URL(value);
		return normalized.toString().replace(/\/$/, '');
	} catch (error) {
		console.warn('Invalid ATP_PDS_URL provided, falling back to default.', error);
		return DEFAULT_PDS_URL;
	}
};

export const ATP_PDS_URL = sanitizeUrl(env.ATP_PDS_URL ?? DEFAULT_PDS_URL);

export const NODE_ENV = env.NODE_ENV ?? 'development';

export const IS_PRODUCTION = NODE_ENV === 'production';

export const SESSION_COOKIE_NAME = 'atweet.session';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
