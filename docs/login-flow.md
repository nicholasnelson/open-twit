# Login Flow

This document describes how atweet authenticates a user against the AT Protocol and how the resulting session is persisted across requests.

## Components
- `src/routes/+page.svelte`: Renders the handle input, displays callback errors, and shows the authenticated summary when a session is present.
- `src/routes/+page.server.ts`: Exposes the session to the page load, triggers OAuth-backed posting via `createAuthenticatedAgent`, and revokes tokens on logout.
- `src/routes/auth/login/+server.ts`: Creates the OAuth authorization URL (state handled by the client library) and redirects the browser to Bluesky.
- `src/routes/auth/callback/+server.ts`: Lets the client library validate state, exchanges the authorization code, persists the session cookie, and handles error redirects.
- `src/lib/server/auth/oauth-client.ts` & `oauth-store.ts`: Instantiate `NodeOAuthClient` with SQLite-backed state/session storage.
- `src/lib/server/session.ts`: Serializes both legacy (app-password) and OAuth session payloads into the `atweet.session` cookie.
- `src/hooks.server.ts`: Hydrates `event.locals.session` from the cookie for every request.
- `.env`: Supplies `ATPROTO_OAUTH_CLIENT_ID`, redirect URIs, and related OAuth metadata.

## Happy Path Sequence
1. **Initial page load**
   - `src/hooks.server.ts` loads `atweet.session` (if present) into `event.locals.session`.
   - `src/routes/+page.server.ts` returns `locals.session`, any auth error codes, and the last submitted handle to the Svelte page.
   - `src/routes/+page.svelte` renders either the session summary (authenticated) or the OAuth handle form (guest).

2. **Starting OAuth**
   - Submitting the handle issues a `GET /auth/login?handle=example.bsky.social` request.
   - The login endpoint checks that OAuth is enabled, asks the client for an authorization URL (which generates/records state internally), and redirects the browser to Bluesky.

3. **Callback Processing**
   - After the user approves the request, Bluesky redirects to `/auth/callback?code=…&state=…`.
   - `NodeOAuthClient.callback` validates the state/PKCE values it generated earlier, returning an `OAuthSession` on success. We instantiate an `Agent`, fetch the user handle via `agent.com.atproto.server.getSession()`, and persist a cookie with `{ mode: 'oauth', did, handle, service }`.
   - `locals.session` is set for the current request, and the handler issues a 303 redirect back to `/`.

4. **Authenticated requests**
   - When the user triggers the twit action, `createAuthenticatedAgent` restores the OAuth session from the SQLite store and returns an `Agent`. Tokens are refreshed automatically by the OAuth client when near expiry.
   - Legacy sessions (kept for development) still resume via app passwords; their cookies are refreshed with new JWTs after each twit.

5. **Logout**
   - Posting the logout form hits the `?/logout` action. OAuth sessions call `oauthClient.revoke(session.did)` before clearing cookies; legacy sessions simply drop the cookie.
   - The action redirects with HTTP 303 to `/`.

## Error Handling
- Invalid or missing handle input results in `/?authError=missing_handle`.
- State mismatches or callback failures clear cookies and redirect with descriptive query parameters; the page surfaces the message above the sign-in form.
- OAuth session restore failures throw an error tagged with `status: 401`, allowing the twit action to clear cookies and prompt the user to re-authenticate.
- `getSessionFromCookies` invalidates malformed JSON/corrupted cookies proactively.

## Configuration Notes
- `ATPROTO_OAUTH_CLIENT_ID` must point at a reachable `client-metadata.json` endpoint (the repository serves one automatically).
- `ATPROTO_OAUTH_REDIRECT_URI` should list every redirect URI registered with Bluesky (comma-separated). The first entry is used by `/auth/login`.
- `ATPROTO_OAUTH_STORE_FILE` keeps OAuth state/session data in SQLite; ensure the process can write to the directory.
- `SESSION_COOKIE_NAME` and `SESSION_MAX_AGE_SECONDS` still live in `src/lib/server/env.ts` for centralized tweaking.
