# Twit Action Flow

This document outlines how the Phase 2 "twit" action is implemented in atweet after a user signs in with the AT Protocol.

## Components
- `src/lib/server/agent.ts`: Exposes `createAuthenticatedAgent`, which resumes a `BskyAgent` from the stored session and targets the user’s PDS.
- `src/routes/+page.server.ts`: Hosts the `twit` form action. It validates the current session, writes a `com.atweet.twit` record, refreshes the session cookie, and returns UI metadata (status, timestamp, cooldown expiry).
- `src/routes/+page.svelte`: Renders the authenticated UI, including the "Fire a twit" form, cooldown timer, and success/error messaging.
- `static/lexicons/com.atweet.twit.json`: Defines the `com.atweet.twit` record schema with the `createdAt` timestamp field.

## Happy Path Sequence
1. **Form submission** – The authenticated user submits the `?/twit` form. The request is routed to the `twit` action.
2. **Session resume** – The action loads the persisted session (`locals.session`) and calls `createAuthenticatedAgent` to resume the `BskyAgent` using the stored tokens and service URL.
3. **Record creation** – The server calls `agent.com.atproto.repo.createRecord` with `collection: 'com.atweet.twit'`, `repo: session.did`, and a payload containing `createdAt: new Date().toISOString()`.
4. **Session refresh** – After the write, the action normalizes `agent.session` via `toSessionPayload`, updates the HTTP-only session cookie, and mirrors the payload back into `locals.session`.
5. **Feed update** – The newly created record (URI, CID, author metadata, timestamps) is appended to the feed repository so the feed endpoint can surface it immediately.
6. **Response metadata** – The action returns a success payload with the twit timestamp, URI, and a five-second cooldown expiry. The Svelte page uses this to render a success banner and disable the button until the cooldown elapses.

## Failure Modes
- **No active session** – The action returns `fail(401, …)` prompting the user to sign in before twiting.
- **Expired/invalid session** – If the PDS rejects the request with a 401, the action clears the cookie, resets `locals.session`, and returns an error asking the user to reauthenticate.
- **Unexpected errors** – Other failures are logged to the server console and surfaced to the user as a generic "Failed to send twit" message.

## UI Behaviour
- Success responses show the recorded timestamp using a `<time>` element and start the cooldown timer.
- During the cooldown, the button is disabled and displays a live countdown updated every 250ms.
- Error responses (validation or transport) are displayed inline with accessible `aria-live="polite"` regions.

## Cooldown Notes
- The cooldown is implemented client-side based on the expiry returned from the action. It mitigates accidental double submissions but does not enforce a server-side rate limit.
- The cooldown window (`TWIT_COOLDOWN_SECONDS`) is currently five seconds and can be adjusted in `src/routes/+page.server.ts`.

## Extensibility
- Reuse `createAuthenticatedAgent` for other authenticated actions that must run on behalf of the signed-in user.
- Server-side rate limits or audit logging can be layered onto the `twit` action without changing the client contract.
- The response payload already exposes `twitTimestamp` and `cooldownExpiresAt`, which can seed future optimistic UI updates such as local feed previews.
