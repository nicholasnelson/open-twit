# Login Flow

This document explains how atweet authenticates users through AT Protocol OAuth and how sessions persist across requests.

## Components
- `src/routes/+page.svelte`: Toggles the `LoginPanel` modal, surfaces callback errors, and renders the authenticated twit controls when a session is present.
- `src/lib/components/LoginPanel.svelte`: Collects the handle/DID input, displays validation messages, and submits to `/auth/login`.
- `src/routes/+page.server.ts`: Loads the session for the page, surfaces auth error codes, handles the twit/logout actions, and revokes OAuth tokens when signing out.
- `src/routes/auth/login/+server.ts`: Validates the incoming handle, asks the OAuth client for an authorization URL, and redirects the browser to Bluesky.
- `src/routes/auth/callback/+server.ts`: Delegates state/PKCE validation to `NodeOAuthClient`, exchanges the authorization code, hydrates user metadata, and persists the session cookie.
- `src/lib/server/auth/oauth-client.ts` & `oauth-store.ts`: Instantiate the singleton `NodeOAuthClient` backed by SQLite for OAuth state/session storage.
- `src/lib/server/session.ts`: Serializes and restores both OAuth and legacy app-password payloads inside the `atweet.session` cookie.
- `src/hooks.server.ts`: Boots the Jetstream consumer and hydrates `event.locals.session` from cookies on every request.
- `.env`: Supplies the OAuth client metadata, redirect URIs, scope, and storage file locations.

## Happy Path Sequence
1. **Initial page load**
   - `src/hooks.server.ts` reads `atweet.session`; if valid, it assigns the payload to `event.locals.session`.
   - `src/routes/+page.server.ts` returns the session along with any query-string error codes and the last submitted handle value.
   - `src/routes/+page.svelte` renders the twit button when authenticated or a `Log in` button that opens the `LoginPanel` modal for guests.

2. **Starting OAuth**
   - Submitting the modal form issues `GET /auth/login?handle=example.bsky.social`.
   - The login endpoint ensures OAuth is configured, resolves the primary redirect URI, and asks `NodeOAuthClient.authorize` for an authorization URL.
   - The handler appends scope/redirect query params for transparency before issuing a 302 redirect to Bluesky.

3. **Callback Processing**
   - After approval, Bluesky redirects to `/auth/callback?code=…&state=…`.
   - `NodeOAuthClient.callback` verifies state + PKCE, returning an OAuth session object.
   - An `Agent` fetches the latest DID/handle. `createOAuthSessionPayload` normalizes `{ mode: 'oauth', did, handle, service }` and `setSessionCookie` stores it. The request finishes with a 303 redirect to `/`.

4. **Authenticated requests**
   - `createAuthenticatedAgent` restores the OAuth session from SQLite whenever the user twits. Tokens refresh automatically; updated data stay server-side.
   - Legacy sessions (kept for development) still resume via app passwords and refresh JWTs before writing to the cookie.

5. **Logout**
   - Posting the logout form calls the `logout` action. OAuth sessions invoke `oauthClient.revoke(session.did)` before clearing cookies; legacy sessions simply drop the cookie.
   - The action finishes with a 303 redirect to `/` and removes `locals.session`.

## Error Handling
- Missing handles trigger `/?authError=missing_handle`; the modal surfaces the translated copy inline.
- Disabled OAuth or missing redirect URI values become `oauth_disabled` / `missing_redirect` error codes.
- Callback failures clear cookies, reset `locals.session`, and redirect with `authError=callback_failed`.
- Restoring an OAuth session can throw a `{ status: 401 }` error; the twit action clears cookies and instructs the client to sign in again.
- Corrupted cookies are invalidated proactively by `getSessionFromCookies`.

## Configuration Notes
- `ATPROTO_OAUTH_CLIENT_ID` must resolve to a reachable `client-metadata.json` endpoint (served from `/client-metadata.json`).
- `ATPROTO_OAUTH_REDIRECT_URI` is a comma-separated list; the first entry seeds `/auth/login` and must match what Bluesky has registered.
- `ATPROTO_OAUTH_STORE_FILE` points to the SQLite store for OAuth state/session data; keep the directory writable.
- `SESSION_COOKIE_NAME` and `SESSION_MAX_AGE_SECONDS` are defined in `src/lib/server/env.ts` to keep cookie policy centralized.
- Set `ATPROTO_OAUTH_ALLOW_HTTP=true` for local development if you need to test against non-HTTPS issuers or redirect URIs.
