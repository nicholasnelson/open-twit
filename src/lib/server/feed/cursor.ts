import { promises as fs } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { JETSTREAM_CURSOR_FILE } from '$lib/server/env';

const CURSOR_FILE_PATH = resolvePath(JETSTREAM_CURSOR_FILE);

export const readPersistedCursor = async (): Promise<number | undefined> => {
	try {
		const raw = await fs.readFile(CURSOR_FILE_PATH, 'utf-8');
		const value = Number(raw.trim());
		return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined;
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
			console.warn('Failed to read Jetstream cursor file.', error);
		}
		return undefined;
	}
};

let latestCursor: number | undefined;
let persistTimeout: NodeJS.Timeout | null = null;

const flushCursorToDisk = async (): Promise<void> => {
	if (typeof latestCursor !== 'number') return;
	try {
		await fs.writeFile(CURSOR_FILE_PATH, `${latestCursor}\n`, 'utf-8');
	} catch (error) {
		console.warn('Failed to persist Jetstream cursor.', error);
	}
};

export const schedulePersistCursor = (cursor: number): void => {
	latestCursor = cursor;
	if (persistTimeout) return;

	persistTimeout = setTimeout(async () => {
		persistTimeout = null;
		await flushCursorToDisk();
	}, 1000).unref?.();
};

export const persistCursorImmediately = async (): Promise<void> => {
	if (persistTimeout) {
		clearTimeout(persistTimeout);
		persistTimeout = null;
	}
	await flushCursorToDisk();
};
