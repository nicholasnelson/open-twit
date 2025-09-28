# Twit Action Flow

This document tracks how the Phase 2 "twit" action currently operates now that OAuth and the SQLite-backed feed repository are in place.

## Components
- `src/lib/server/agent.ts`: Provides `createAuthenticatedAgent`, resuming a `BskyAgent` from either an OAuth payload or legacy session tokens.
- `src/routes/+page.server.ts`: Implements the `twit` and `logout` actions, validates the session, writes records, mirrors them into the repository, and refreshes cookies.
- `src/routes/+page.svelte`: Renders the authenticated `TWIT` button, exposes cooldown messaging, and invokes the login modal when guests attempt the action.
- `src/lib/server/feed/store.ts`: Supplies the shared repository instance used to keep the feed in sync after each submission.
- `static/lexicons/com.atweet.twit.json`: Defines the `com.atweet.twit` schema with the single `createdAt` timestamp.

## Happy Path Sequence
1. **Form submission** – The authenticated user submits the `?/twit` form by clicking `TWIT`.
2. **Session resume** – The action loads `locals.session` and calls `createAuthenticatedAgent`, restoring either an OAuth-backed agent or a legacy session.
3. **Record creation** – The server writes to `agent.com.atproto.repo.createRecord` with `collection: 'com.atweet.twit'`, `repo: session.did`, and `{ createdAt: new Date().toISOString() }`.
4. **Session refresh** – OAuth sessions remain opaque; legacy sessions refresh JWTs and update the cookie via `setSessionCookie` to keep expiry aligned.
5. **Feed update** – The action mirrors `{ uri, cid, recordCreatedAt, indexedAt, authorDid, authorHandle }` into the repository so the feed endpoint and UI reflect the new twit immediately.
6. **Response metadata** – The action returns `{ formType: 'twit', twitStatus: 'success', twitTimestamp, cooldownExpiresAt, twitUri }`. The UI uses the timestamps to manage cooldown state.

## Failure Modes
- **No active session** – Returns `fail(401, …)` prompting the client to sign in before twiting.
- **OAuth restore failure** – When `createAuthenticatedAgent` throws a `status: 401` error, the action clears cookies, resets `locals.session`, and surfaces "Your session expired. Please sign in again.".
- **Unexpected errors** – Any other failure logs to the server console and returns a generic "Failed to send twit" message.

## UI Behaviour
- Success responses disable the button and show a cooldown countdown; the button re-enables once the expiry passes.
- Error responses render inline via `aria-live="polite"` messaging from the server form state.
- Guests tapping `TWIT` toggle the login modal without submitting the form.

## Cooldown Notes
- The five-second cooldown is enforced client-side based on `cooldownExpiresAt`. It helps prevent rapid double submissions but does not hard-stop requests from other clients.
- The interval driving the countdown runs every 250ms to keep the displayed seconds responsive.
- Adjust the window by updating `TWIT_COOLDOWN_SECONDS` in `src/routes/+page.server.ts`.

## Extensibility
- `createAuthenticatedAgent` can be reused for additional authenticated operations (e.g., deleting twits, posting metadata).
- Server-side throttles or logging can wrap the repository write without changing the client contract.
- The action already returns the record URI; future features can leverage it for optimistic feed previews or deep links.
