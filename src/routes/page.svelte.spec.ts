import { page } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { Session } from '$lib/server/session';

const createDefaultProps = () => ({
	data: { session: null },
	form: null
});

const createSession = (overrides: Partial<Session> = {}): Session => ({
	did: 'did:plc:example',
	handle: 'example.test',
	accessJwt: 'access-token',
	refreshJwt: 'refresh-token',
	service: 'https://pds.example.com',
	...overrides
});

describe('/+page.svelte', () => {
	beforeEach(() => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ cursor: null, items: [] })
		} as unknown as Response);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the login form when no session exists', async () => {
		render(Page, createDefaultProps());

		const heading = page.getByRole('heading', { name: 'Twit playground' });
		await expect.element(heading).toBeInTheDocument();

		const signInButton = page.getByRole('button', { name: 'Sign in' });
		await expect.element(signInButton).toBeInTheDocument();
	});

	it('renders the twit button when a session exists', async () => {
		render(Page, { data: { session: createSession() }, form: null });

		const twitButton = page.getByRole('button', { name: /fire a twit/i });
		await expect.element(twitButton).toBeInTheDocument();

		const signOutButton = page.getByRole('button', { name: 'Sign out' });
		await expect.element(signOutButton).toBeInTheDocument();
	});

	it('shows the feed heading regardless of session state', async () => {
		render(Page, createDefaultProps());

		const feedHeading = page.getByRole('heading', { name: /latest twits/i });
		await expect.element(feedHeading).toBeInTheDocument();
	});
});
