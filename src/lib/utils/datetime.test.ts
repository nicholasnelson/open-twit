import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './datetime';

describe('formatRelativeTime', () => {
  it('returns "Just now" when the target time is in the future compared to base', () => {
    const base = new Date('2024-01-01T00:00:00.000Z');
    const future = new Date(base.getTime() + 60_000);

    expect(formatRelativeTime(future, base)).toBe('Just now');
  });
});
