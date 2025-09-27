# Feed UI

Phase 4 adds a client-side feed experience that consumes the `/api/feed` endpoint and renders recent twits with live updates.

## Components
- `src/lib/components/TwitFeed.svelte`: Fetches feed data, handles pagination and periodic refresh, and renders the list with loading/error states.
- `src/lib/utils/datetime.ts`: Provides helpers for relative and absolute time formatting used by the feed display.
- `src/routes/+page.svelte`: Embeds the `TwitFeed` component beneath the authentication panel so both guests and signed-in users can see the latest activity.
- `src/routes/page.svelte.spec.ts`: Stubs network calls during browser tests and asserts that the feed heading renders.

## Behaviour
1. On mount, the component requests `/api/feed?limit=20` and shows shimmer placeholders until the response arrives.
2. Each successful twit appended to the in-memory store becomes visible immediately on the next refresh loop (every 5 seconds) or when the user presses the manual **Refresh** button.
3. Pagination is cursor-based. The **Load more** button asks the API for the next page, merging older entries without duplicating URIs already in view.
4. Relative timestamps update every minute so the "twitted 2 minutes ago" copy stays fresh without additional network round-trips.
5. Failures surface inline with a retry affordance; automatic refresh attempts continue quietly in the background.

## Accessibility Notes
- Lists use semantic `<ul>/<li>` wrappers; handles and DIDs are exposed as text for screen readers.
- Action buttons gain disabled styling during network work to prevent duplicate requests while keeping the UI responsive via manual refresh.
- Timestamps include both relative text and an absolute formatted time, ensuring clarity for all users.

## Future Enhancements
- Replace the in-memory store with a shared cache (Redis, SQLite, etc.) when multi-instance deployments are needed.
- Surface optimistic entries for the author immediately after firing a twit to tighten UX feedback loops.
- Add client-side filtering or grouping once additional metadata (for example, twit categories) is available.
