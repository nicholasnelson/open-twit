import { BskyAgent, type AtpSessionData } from '@atproto/api';
import { ATP_PDS_URL } from './env';
import type { Session } from './session';

export const createAgent = (service: string = ATP_PDS_URL): BskyAgent => new BskyAgent({ service });

const toAtpSessionData = (session: Session): AtpSessionData => ({
	did: session.did,
	handle: session.handle,
	accessJwt: session.accessJwt,
	refreshJwt: session.refreshJwt,
	active: true
});

export const createAuthenticatedAgent = async (session: Session): Promise<BskyAgent> => {
	const agent = createAgent(session.service);
	await agent.resumeSession(toAtpSessionData(session));
	return agent;
};
