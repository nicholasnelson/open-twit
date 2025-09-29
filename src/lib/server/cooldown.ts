const COOLDOWN_SECONDS = 5;
const COOLDOWN_MS = COOLDOWN_SECONDS * 1000;

const cooldowns = new Map<string, number>();

const purgeIfExpired = (did: string): number | null => {
	const expiresAtMs = cooldowns.get(did) ?? null;
	if (!expiresAtMs) return null;
	if (expiresAtMs <= Date.now()) {
		cooldowns.delete(did);
		return null;
	}
	return expiresAtMs;
};

export const getCooldownStatus = (
	did: string
): {
	active: boolean;
	expiresAt: string | null;
	remainingMs: number;
} => {
	const expiresAtMs = purgeIfExpired(did);
	if (!expiresAtMs) {
		return { active: false, expiresAt: null, remainingMs: 0 };
	}

	return {
		active: true,
		expiresAt: new Date(expiresAtMs).toISOString(),
		remainingMs: Math.max(0, expiresAtMs - Date.now())
	};
};

export const beginCooldown = (did: string): string => {
	const expiresAtMs = Date.now() + COOLDOWN_MS;
	cooldowns.set(did, expiresAtMs);
	return new Date(expiresAtMs).toISOString();
};

export const SHARED_COOLDOWN_SECONDS = COOLDOWN_SECONDS;
