import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginCooldown, getCooldownStatus } from './cooldown';

describe('cooldown', () => {
	const did = 'did:plc:test';

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('reports inactive status when no cooldown has started', () => {
		const status = getCooldownStatus(did);
		expect(status).toEqual({ active: false, expiresAt: null, remainingMs: 0 });
	});

	it('begins a cooldown and reports remaining time', () => {
		const expiresAt = beginCooldown(did);
		const status = getCooldownStatus(did);

		expect(expiresAt).toBe('2024-01-01T00:00:05.000Z');
		expect(status.active).toBe(true);
		expect(status.expiresAt).toBe(expiresAt);
		expect(status.remainingMs).toBe(5000);
	});

	it('clears cooldown after expiry', () => {
		beginCooldown(did);
		vi.advanceTimersByTime(6000);

		const status = getCooldownStatus(did);
		expect(status).toEqual({ active: false, expiresAt: null, remainingMs: 0 });
	});
});
