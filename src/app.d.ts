import type { Session } from '$lib/server/session';

declare global {
	namespace App {
		interface Locals {
			session: Session | null;
		}

		interface PageData {
			session: Session | null;
			authError: string | null;
			authHandle: string;
		}

		interface ActionData {
			formType: 'twit';
			twitStatus?: 'success' | 'error';
			message?: string;
			twitTimestamp?: string;
			cooldownExpiresAt?: string;
			twitUri?: string;
		}
	}
}

export {};
