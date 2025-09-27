import { fail, redirect } from '@sveltejs/kit';
import { createAgent, createAuthenticatedAgent } from '$lib/server/agent';
import {
	clearSessionCookie,
	setSessionCookie,
	toSessionPayload
} from '$lib/server/session';
import { twitStore } from '$lib/server/feed/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	session: locals.session
});

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0;

const TWIT_COLLECTION = 'com.atweet.twit';
const TWIT_COOLDOWN_SECONDS = 5;

const isUnauthorizedError = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'status' in error &&
	typeof (error as { status?: number }).status === 'number' &&
	(error as { status: number }).status === 401;

export const actions: Actions = {
	login: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const identifier = formData.get('identifier');
		const password = formData.get('password');

		if (!isNonEmptyString(identifier) || !isNonEmptyString(password)) {
			return fail(400, {
				formType: 'login',
				message: 'Handle or DID and an app password are required.',
				identifier: isNonEmptyString(identifier) ? identifier : ''
			});
		}

		const agent = createAgent();

		try {
			await agent.login({ identifier, password });
			const session = agent.session;

			if (!session) {
				return fail(500, {
					formType: 'login',
					message: 'Login succeeded but no session was returned. Please try again.',
					identifier
				});
			}

			const payload = toSessionPayload(session, agent.serviceUrl.toString());
			setSessionCookie(cookies, payload);
			locals.session = payload;

			return redirect(303, '/');
		} catch (error) {
			console.error('Login failed', error);
			return fail(400, {
				formType: 'login',
				message: 'Login failed. Double-check your handle and app password.',
				identifier
			});
		}
	},
	logout: async ({ cookies, locals }) => {
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
			const agent = await createAuthenticatedAgent(session);
			const record = {
				createdAt: new Date().toISOString()
			};

			const response = await agent.com.atproto.repo.createRecord({
				repo: session.did,
				collection: TWIT_COLLECTION,
				record
			});

			if (!agent.session) {
				return fail(500, {
					formType: 'twit',
					twitStatus: 'error',
					message: 'Twit succeeded but no session was returned. Please sign in again.'
				});
			}

			const payload = toSessionPayload(agent.session, agent.serviceUrl.toString());
			setSessionCookie(cookies, payload);
			locals.session = payload;

			twitStore.add({
				authorDid: payload.did,
				authorHandle: payload.handle,
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
