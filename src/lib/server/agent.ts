import { Agent, BskyAgent, type AtpSessionData } from '@atproto/api';
import { ATP_PDS_URL } from './env';
import type { LegacySession, Session } from './session';
import { getOAuthClient } from './auth/oauth-client';
import { toSessionPayload } from './session';

export const createAgent = (service: string = ATP_PDS_URL): BskyAgent => new BskyAgent({ service });

const toAtpSessionData = (session: LegacySession): AtpSessionData => ({
	did: session.did,
	handle: session.handle,
	accessJwt: session.accessJwt,
	refreshJwt: session.refreshJwt,
	active: true
});

const isLegacySession = (session: Session): session is LegacySession => session.mode === 'legacy';

export type AuthenticatedAgentResult = {
	agent: Agent;
	updatedSession?: LegacySession;
};

export const createAuthenticatedAgent = async (session: Session): Promise<AuthenticatedAgentResult> => {
	if (isLegacySession(session)) {
		const agent = createAgent(session.service);
		await agent.resumeSession(toAtpSessionData(session));
		const hydrated = agent.session;
		if (!hydrated) {
			throw new Error('Failed to resume legacy session.');
		}
		return {
			agent,
			updatedSession: toSessionPayload(hydrated, agent.serviceUrl.toString())
		};
	}

	const client = getOAuthClient();
	try {
		const oauthSession = await client.restore(session.did, 'auto');
		return {
			agent: new Agent(oauthSession)
		};
	} catch (error) {
		const unauthorized = new Error('Failed to restore OAuth session.', { cause: error });
		Object.assign(unauthorized, { status: 401 });
		throw unauthorized;
	}
};
