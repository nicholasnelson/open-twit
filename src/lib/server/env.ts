import { env } from '$env/dynamic/private';
import { isAbsolute, resolve as resolvePath } from 'node:path';

const DEFAULT_PDS_URL = 'https://bsky.social';
const DEFAULT_JETSTREAM_ENDPOINT = 'wss://jetstream1.us-east.bsky.network/subscribe';
const DEFAULT_JETSTREAM_CURSOR_FILE = '.jetstream-cursor';

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

const sanitizeWebsocketUrl = (value: string): string => {
	try {
		const normalized = new URL(value);
		if (!['ws:', 'wss:'].includes(normalized.protocol)) {
			throw new Error(`Unsupported protocol for Jetstream endpoint: ${normalized.protocol}`);
		}
		return normalized.toString();
	} catch (error) {
		console.warn('Invalid JETSTREAM_ENDPOINT provided, falling back to default.', error);
		return DEFAULT_JETSTREAM_ENDPOINT;
	}
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
	if (typeof value !== 'string') return fallback;
	const normalized = value.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
	if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
	return fallback;
};

const parseCursor = (value: string | undefined): number | undefined => {
	if (!value) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		console.warn('Invalid JETSTREAM_CURSOR provided; ignoring value.');
		return undefined;
	}
	return Math.trunc(parsed);
};

const resolveCursorFile = (value: string | undefined): string => {
	const fallbackPath = resolvePath(process.cwd(), DEFAULT_JETSTREAM_CURSOR_FILE);
	if (!value || value.trim().length === 0) return fallbackPath;
	return isAbsolute(value) ? value : resolvePath(process.cwd(), value);
};

export const JETSTREAM_ENABLED = parseBoolean(env.JETSTREAM_ENABLED, false);

export const JETSTREAM_ENDPOINT = sanitizeWebsocketUrl(
	env.JETSTREAM_ENDPOINT ?? DEFAULT_JETSTREAM_ENDPOINT
);

export const JETSTREAM_INITIAL_CURSOR = parseCursor(env.JETSTREAM_CURSOR);

export const JETSTREAM_CURSOR_FILE = resolveCursorFile(env.JETSTREAM_CURSOR_FILE);

const toOptionalString = (value: string | undefined): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const resolveStoreFile = (value: string | undefined, fallback: string): string => {
	const resolved = toOptionalString(value);
	if (!resolved) return resolvePath(process.cwd(), fallback);
	return isAbsolute(resolved) ? resolved : resolvePath(process.cwd(), resolved);
};

export const OAUTH_CLIENT_NAME = toOptionalString(env.ATPROTO_OAUTH_CLIENT_NAME);
export const OAUTH_CLIENT_URI = toOptionalString(env.ATPROTO_OAUTH_CLIENT_URI);
export const OAUTH_POLICY_URI = toOptionalString(env.ATPROTO_OAUTH_POLICY_URI);
export const OAUTH_TOS_URI = toOptionalString(env.ATPROTO_OAUTH_TOS_URI);
export const OAUTH_LOGO_URI = toOptionalString(env.ATPROTO_OAUTH_LOGO_URI);

const rawRedirectSetting = toOptionalString(env.ATPROTO_OAUTH_REDIRECT_URI);
export const OAUTH_SCOPE = toOptionalString(env.ATPROTO_OAUTH_SCOPE) ?? 'atproto transition:generic';

const resolvePrimaryRedirectUri = (value: string | null): string | null => {
	if (!value) return null;
	return value
		.split(',')
		.map((entry) => entry.trim())
		.find((entry) => entry.length > 0) ?? null;
};

const primaryRedirectUri = resolvePrimaryRedirectUri(rawRedirectSetting);
const DEFAULT_OAUTH_CLIENT_ID = 'http://localhost';

const buildDevClientId = (): string => {
	const params = new URLSearchParams();
	params.set('scope', OAUTH_SCOPE);
	if (primaryRedirectUri) {
		params.set('redirect_uri', primaryRedirectUri);
	}
	return `${DEFAULT_OAUTH_CLIENT_ID}?${params.toString()}`;
};

const rawClientId = toOptionalString(env.ATPROTO_OAUTH_CLIENT_ID);
const resolvedClientId = rawClientId ?? DEFAULT_OAUTH_CLIENT_ID;

export const OAUTH_CLIENT_ID =
	resolvedClientId === DEFAULT_OAUTH_CLIENT_ID ? buildDevClientId() : resolvedClientId;

export const OAUTH_REDIRECT_URI = rawRedirectSetting;
export const OAUTH_ALLOW_HTTP = parseBoolean(env.ATPROTO_OAUTH_ALLOW_HTTP, false);
export const OAUTH_STORE_FILE = resolveStoreFile(env.ATPROTO_OAUTH_STORE_FILE, '.data/oauth-store.sqlite');

export const OAUTH_ENABLED = Boolean(OAUTH_CLIENT_ID && OAUTH_REDIRECT_URI);
