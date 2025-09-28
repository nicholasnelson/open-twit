# Feed UI

Phase 4 introduced the client-side feed; recent refactors tightened the polling loop, dedupe logic, and handling for SQLite-backed data.

## Components
- `src/lib/components/TwitFeed.svelte`: Orchestrates initial fetch, interval refresh, cursor pagination, and rendering of loading/empty/error states.
- `src/lib/utils/datetime.ts`: Formats relative and absolute timestamps so the list stays fresh without extra round-trips.
- `src/routes/+page.svelte`: Mounts `TwitFeed` beneath the twit action so both guests and signed-in users can watch activity roll in.
- `src/routes/page.svelte.spec.ts`: Uses `@vitest/browser` to stub `/api/feed` and confirm the page mounts the feed scaffold during browser-driven tests.

## Behaviour
1. Initial mount requests `/api/feed?limit=20`; skeleton cards display until the payload resolves.
2. A five-second interval re-fetches the first page and prepends any unseen entries produced locally or streamed in via Jetstream.
3. Cursor-based pagination powers the **Load more** button, merging older items while skipping URIs already present.
4. A one-minute clock tick recomputes relative timestamps so the "twitted moments ago" copy stays accurate.
5. Network failures surface inline with retry affordances; scheduled refreshes keep running quietly once the error clears.

## Accessibility Notes
- The list uses semantic `<ul>/<li>` markup; handles fall back to DIDs, ensuring screen readers always announce an author.
- Buttons expose disabled states and aria-live messaging so cooldowns, retries, and successes are announced.
- Relative timestamps include accessible text alternatives (absolute times exposed via `formatAbsoluteTime`).

### Audit Follow-ups (2025-02)
- ✅ Verified that cooldown and error messages surface through `aria-live="polite"` regions.
- ✅ Confirmed keyboard focus lands on newly rendered feed items without trapping navigation.
- ⚠️ New feed entries that arrive during polling are not announced; consider adding an `aria-live` summary banner for background updates.
- ⚠️ The modal login flow relies on the browser’s default focus behaviour; add initial focus to the handle input and a focus trap to keep keyboard users inside the dialog.

## Future Enhancements
- Surface optimistic entries for the author immediately after twiting, then reconcile once Jetstream confirms.
- Allow manual refresh or "new items" badges for power users who want more control than the five-second cadence.
- Introduce lightweight filtering (for example, show only my twits) once additional metadata is available.
