# Login Flow

This document describes how atweet authenticates a user against the AT Protocol and how the resulting session is persisted across requests.

## Components
- `src/routes/+page.svelte`: Renders the login form and shows session state returned by the server.
- `src/routes/+page.server.ts`: Implements the `login` and `logout` form actions and exposes the current session to the page load.
- `src/lib/server/agent.ts`: Creates a configured `BskyAgent` pointed at the target Personal Data Server (PDS).
- `src/lib/server/session.ts`: Serializes session data, stores it in an HTTP-only cookie, and reads it back on subsequent requests.
- `src/hooks.server.ts`: Loads the session from the cookie into `event.locals` before route handlers run.
- `.env`: Provides `ATP_PDS_URL`, the base URL of the PDS to authenticate against during development.

## Happy Path Sequence
1. **Initial page load**
   - `src/hooks.server.ts` invokes `getSessionFromCookies`, hydrating `event.locals.session` from the `atweet.session` cookie if it exists.
   - The root page server load (`src/routes/+page.server.ts:6`) returns `locals.session` to the Svelte component.
   - `src/routes/+page.svelte` either renders the signed-in summary (session found) or the login form (no session).

2. **Submitting credentials**
   - The login form posts to the `?/login` action (`src/routes/+page.server.ts:13`).
   - The action validates that both `identifier` (handle or DID) and `password` (app password) are non-empty strings. Invalid input returns a `fail(400, …)` payload that keeps the user on the form with an inline error message.

3. **Authenticating with Bluesky**
   - A `BskyAgent` instance from `createAgent` (`src/lib/server/agent.ts:3`) targets the configured PDS URL (`ATP_PDS_URL`).
   - `agent.login({ identifier, password })` exchanges the credentials for an ATP session.
   - If no session object is returned, the action reports a 500-level error and asks the user to retry.

4. **Persisting the session**
   - The returned `AtpSessionData` is normalized via `toSessionPayload` (`src/lib/server/session.ts:29`), capturing DID, handle, JWTs, and the normalized service URL.
   - `setSessionCookie` stores the JSON payload into the HTTP-only `atweet.session` cookie with `SameSite=lax`, `Secure` (in production), and a seven-day max age (`SESSION_MAX_AGE_SECONDS`).
   - `locals.session` is set so the current response can render the authenticated state without waiting for another request.
   - The action redirects with HTTP 303 to `/`, ensuring the browser performs a GET and does not resubmit credentials on refresh.

5. **Subsequent requests**
   - On every new request, `hooks.server` rehydrates `event.locals.session` from the cookie. If deserialization fails, the cookie is cleared, forcing re-authentication.
   - The presence of `locals.session` enables server routes and the root page to gate features on authentication status without revalidating credentials each time.

## Error Handling
- Login failures (bad handle/app password, network issues, or rejected credentials) bubble through the catch block in `login`, log to the server console, and surface a generic 400-level message to the user.
- Missing or malformed session cookies are automatically deleted (`getSessionFromCookies`), preventing stale or tampered data from persisting.

## Logout Flow
- The logout form posts to the `?/logout` action (`src/routes/+page.server.ts:48`).
- `clearSessionCookie` removes the `atweet.session` cookie, and `locals.session` is set to `null` for the current request.
- The action redirects with HTTP 303 to `/`, returning the UI to the unauthenticated state.

## Configuration Notes
- `ATP_PDS_URL` (default `https://bsky.social`) controls which PDS the `BskyAgent` uses. Override it in `.env` for local or self-hosted PDS instances.
- `SESSION_COOKIE_NAME` and `SESSION_MAX_AGE_SECONDS` live in `src/lib/server/env.ts` and can be customized if the project’s session requirements change.
