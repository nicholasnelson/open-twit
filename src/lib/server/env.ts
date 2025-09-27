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
