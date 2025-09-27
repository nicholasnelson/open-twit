import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const createDefaultProps = () => ({
	data: { session: null },
	form: null
});

describe('/+page.svelte', () => {
	it('renders the login form when no session exists', async () => {
		render(Page, createDefaultProps());

		const heading = page.getByRole('heading', { name: 'Twit playground' });
		await expect.element(heading).toBeInTheDocument();

		const signInButton = page.getByRole('button', { name: 'Sign in' });
		await expect.element(signInButton).toBeInTheDocument();
	});
});
