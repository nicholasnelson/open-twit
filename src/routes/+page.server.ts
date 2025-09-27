import { fail, redirect } from '@sveltejs/kit';
import { createAgent } from '$lib/server/agent';
import { clearSessionCookie, setSessionCookie, toSessionPayload } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	session: locals.session
});

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0;

export const actions: Actions = {
	login: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const identifier = formData.get('identifier');
		const password = formData.get('password');

		if (!isNonEmptyString(identifier) || !isNonEmptyString(password)) {
			return fail(400, {
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
				message: 'Login failed. Double-check your handle and app password.',
				identifier
			});
		}
	},
	logout: async ({ cookies, locals }) => {
		clearSessionCookie(cookies);
		locals.session = null;

		return redirect(303, '/');
	}
};
