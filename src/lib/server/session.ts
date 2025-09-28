import type { Cookies } from '@sveltejs/kit';
import type { AtpSessionData } from '@atproto/api';
import {
	ATP_PDS_URL,
	IS_PRODUCTION,
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS
} from './env';

export type LegacySession = {
	mode: 'legacy';
	did: string;
	handle: string;
	accessJwt: string;
	refreshJwt: string;
	service: string;
};

export type OAuthSessionPayload = {
	mode: 'oauth';
	did: string;
	handle: string;
	service: string;
};

export type Session = LegacySession | OAuthSessionPayload;

const isLegacySession = (value: Partial<Session>): value is LegacySession =>
	value?.mode === 'legacy' &&
	typeof value.did === 'string' &&
	typeof value.handle === 'string' &&
	typeof value.accessJwt === 'string' &&
	typeof value.refreshJwt === 'string' &&
	typeof value.service === 'string';

const isOAuthSessionPayload = (value: Partial<Session>): value is OAuthSessionPayload =>
	value?.mode === 'oauth' &&
	typeof value.did === 'string' &&
	typeof value.handle === 'string' &&
	typeof value.service === 'string';

const isValidSession = (value: Partial<Session>): value is Session =>
	isLegacySession(value) || isOAuthSessionPayload(value);

const serialize = (session: Session): string => JSON.stringify(session);

const deserialize = (value: string): Session | null => {
	try {
		const parsed = JSON.parse(value) as Partial<Session>;
		return isValidSession(parsed) ? parsed : null;
	} catch (error) {
		console.warn('Failed to parse stored session cookie.', error);
		return null;
	}
};

type CookieOptions = Parameters<Cookies['set']>[2];

const baseCookieOptions: CookieOptions = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	secure: IS_PRODUCTION,
	maxAge: SESSION_MAX_AGE_SECONDS
};

const normalizeServiceUrl = (value: string): string => value.replace(/\/$/, '');

export const toSessionPayload = (
	session: AtpSessionData,
	serviceUrl: string = ATP_PDS_URL
): LegacySession => ({
	mode: 'legacy',
	did: session.did,
	handle: session.handle,
	accessJwt: session.accessJwt,
	refreshJwt: session.refreshJwt,
	service: normalizeServiceUrl(serviceUrl)
});

export const createOAuthSessionPayload = (
	params: Pick<OAuthSessionPayload, 'did' | 'handle' | 'service'>
): OAuthSessionPayload => ({
	mode: 'oauth',
	did: params.did,
	handle: params.handle,
	service: normalizeServiceUrl(params.service)
});

export const setSessionCookie = (cookies: Cookies, session: Session): void => {
	cookies.set(SESSION_COOKIE_NAME, serialize(session), baseCookieOptions);
};

export const getSessionFromCookies = (cookies: Cookies): Session | null => {
	const raw = cookies.get(SESSION_COOKIE_NAME);
	if (!raw) return null;

	const session = deserialize(raw);
	if (!session) {
		cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	}

	return session;
};

export const clearSessionCookie = (cookies: Cookies): void => {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
};
