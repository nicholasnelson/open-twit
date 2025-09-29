import { fail, redirect } from '@sveltejs/kit';
import { createAuthenticatedAgent } from '$lib/server/agent';
import { clearSessionCookie, setSessionCookie } from '$lib/server/session';
import { getOAuthClient } from '$lib/server/auth/oauth-client';
import { twitRepository } from '$lib/server/feed/store';
import { beginCooldown, getCooldownStatus } from '$lib/server/cooldown';
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
const RETWIT_COLLECTION = 'com.atweet.retwit';

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

		const cooldown = getCooldownStatus(session.did);
		if (cooldown.active) {
			const remainingSeconds = Math.max(1, Math.ceil(cooldown.remainingMs / 1000));
			return fail(429, {
				formType: 'twit',
				twitStatus: 'error',
				message: `Cooldown active. Try again in ${remainingSeconds}s.`,
				cooldownExpiresAt: cooldown.expiresAt
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
				type: 'twit',
				authorDid: activeSession.did,
				authorHandle: activeSession.handle,
				cid: response.data.cid,
				indexedAt: new Date().toISOString(),
				recordCreatedAt: record.createdAt,
				uri: response.data.uri
			});

			const cooldownExpiresAt = beginCooldown(activeSession.did);

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
	},
	retwit: async ({ locals, request, cookies }) => {
		const session = locals.session;
		if (!session) {
			return fail(401, {
				formType: 'retwit',
				retwitStatus: 'error',
				message: 'You need to sign in before retwitting.'
			});
		}

		const formData = await request.formData();
		const uri = (formData.get('uri') || '').toString().trim();
		const cid = (formData.get('cid') || '').toString().trim();

		if (!uri || !cid) {
			return fail(400, {
				formType: 'retwit',
				retwitStatus: 'error',
				message: 'Select a twit to retwit before sharing.'
			});
		}

		const target = await twitRepository.getByUri(uri);
		if (!target || target.type !== 'twit') {
			return fail(400, {
				formType: 'retwit',
				retwitStatus: 'error',
				message: 'Original twit unavailable. Refresh the feed and try again.'
			});
		}

		if (target.cid !== cid) {
			console.warn('Retwit subject CID mismatch; using repository value', {
				providedCid: cid,
				repositoryCid: target.cid,
				targetUri: target.uri
			});
		}

		const subjectCid = target.cid;

		const cooldown = getCooldownStatus(session.did);
		if (cooldown.active) {
			const remainingSeconds = Math.max(1, Math.ceil(cooldown.remainingMs / 1000));
			return fail(429, {
				formType: 'retwit',
				retwitStatus: 'error',
				message: `Cooldown active. Try again in ${remainingSeconds}s.`,
				cooldownExpiresAt: cooldown.expiresAt
			});
		}

		try {
			const { agent, updatedSession } = await createAuthenticatedAgent(session);
			const record = {
				createdAt: new Date().toISOString(),
				subject: {
					uri: target.uri,
					cid: subjectCid
				}
			};

			const response = await agent.com.atproto.repo.createRecord({
				repo: session.did,
				collection: RETWIT_COLLECTION,
				record
			});

			if (updatedSession) {
				setSessionCookie(cookies, updatedSession);
				locals.session = updatedSession;
			} else {
				locals.session = session;
			}

			const activeSession = updatedSession ?? session;
			const indexedAt = new Date().toISOString();

			await twitRepository.add({
				type: 'retwit',
				authorDid: target.authorDid,
				authorHandle: target.authorHandle,
				cid: response.data.cid,
				indexedAt,
				recordCreatedAt: record.createdAt,
				uri: response.data.uri,
				resharedByDid: activeSession.did,
				resharedByHandle: activeSession.handle,
				subjectUri: target.uri,
				subjectCid,
				subjectRecordCreatedAt: target.recordCreatedAt
			});

			const cooldownExpiresAt = beginCooldown(activeSession.did);

			return {
				formType: 'retwit',
				retwitStatus: 'success',
				message: 'Retwit shared.',
				cooldownExpiresAt,
				retwitUri: response.data.uri,
				subjectUri: target.uri
			};
		} catch (error) {
			console.error('Retwit creation failed', error);

			if (isUnauthorizedError(error)) {
				clearSessionCookie(cookies);
				locals.session = null;
				return fail(401, {
					formType: 'retwit',
					retwitStatus: 'error',
					message: 'Your session expired. Please sign in again.'
				});
			}

			return fail(500, {
				formType: 'retwit',
				retwitStatus: 'error',
				message: 'Failed to retwit. Please try again.'
			});
		}
	}
};
