import { fail, redirect } from '@sveltejs/kit';
import { createAuthenticatedAgent } from '$lib/server/agent';
import { clearSessionCookie, setSessionCookie } from '$lib/server/session';
import { getOAuthClient } from '$lib/server/auth/oauth-client';
import { twitRepository } from '$lib/server/feed/store';
import type { Actions, PageServerLoad } from './$types';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
	missing_handle: 'Enter your handle or DID before signing in.',
	oauth_disabled: 'OAuth is not configured for this environment.',
	callback_failed: 'Unable to complete sign-in. Please try again.',
	missing_redirect: 'OAuth redirect URI is not configured. Check your environment variables.'
};

const mapAuthError = (code: string | null): string | null => {
	if (!code) return null;
	return AUTH_ERROR_MESSAGES[code] ?? 'Failed to sign in. Please try again.';
};

export const load: PageServerLoad = async ({ locals, url }) => ({
	session: locals.session,
	authError: mapAuthError(url.searchParams.get('authError')),
	authHandle: url.searchParams.get('handle')?.trim() ?? ''
});

const TWIT_COLLECTION = 'com.atweet.twit';
const TWIT_COOLDOWN_SECONDS = 5;

const isUnauthorizedError = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'status' in error &&
	typeof (error as { status?: number }).status === 'number' &&
	(error as { status: number }).status === 401;


export const actions: Actions = {
	logout: async ({ cookies, locals }) => {
		const session = locals.session;

		if (session?.mode === 'oauth') {
			try {
				const client = getOAuthClient();
				await client.revoke(session.did);
			} catch (error) {
				console.warn('Failed to revoke OAuth session', error);
			}
		}

		clearSessionCookie(cookies);
		locals.session = null;

		return redirect(303, '/');
	},
	twit: async ({ locals, cookies }) => {
		const session = locals.session;

		if (!session) {
			return fail(401, {
				formType: 'twit',
				twitStatus: 'error',
				message: 'You need to sign in before twiting.'
			});
		}

		try {
			const { agent, updatedSession } = await createAuthenticatedAgent(session);
			const record = {
				createdAt: new Date().toISOString()
			};

			const response = await agent.com.atproto.repo.createRecord({
				repo: session.did,
				collection: TWIT_COLLECTION,
				record
			});

			if (updatedSession) {
				setSessionCookie(cookies, updatedSession);
				locals.session = updatedSession;
			} else {
				locals.session = session;
			}

			const activeSession = updatedSession ?? session;

			await twitRepository.add({
				authorDid: activeSession.did,
				authorHandle: activeSession.handle,
					cid: response.data.cid,
					indexedAt: new Date().toISOString(),
					recordCreatedAt: record.createdAt,
					uri: response.data.uri
				});

			const cooldownExpiresAt = new Date(Date.now() + TWIT_COOLDOWN_SECONDS * 1000).toISOString();

			return {
				formType: 'twit',
				twitStatus: 'success',
				twitTimestamp: record.createdAt,
				cooldownExpiresAt,
				twitUri: response.data.uri
			};
		} catch (error) {
			console.error('Twit creation failed', error);

			if (isUnauthorizedError(error)) {
				clearSessionCookie(cookies);
				locals.session = null;
				return fail(401, {
					formType: 'twit',
					twitStatus: 'error',
					message: 'Your session expired. Please sign in again.'
				});
			}

			return fail(500, {
				formType: 'twit',
				twitStatus: 'error',
				message: 'Failed to send twit. Please try again.'
			});
		}
	}
};
