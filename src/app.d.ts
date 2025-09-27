import type { Session } from '$lib/server/session';

declare global {
	namespace App {
		interface Locals {
			session: Session | null;
		}

		interface PageData {
			session: Session | null;
		}

		interface ActionData {
			message?: string;
			identifier?: string;
		}
	}
}

export {};
