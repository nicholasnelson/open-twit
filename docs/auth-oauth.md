# Phase 6.1 · OAuth Authentication Plan

This phase replaces the app-password login flow with OAuth, leveraging the `@atproto/oauth-client-node` package to mediate authentication with a user's PDS/AppView instance.

## Goals
- Keep credentials out of the browser by performing the AT Protocol login through an OAuth redirect/callback sequence.
- Preserve the existing session abstraction so downstream features (twit action, Jetstream ingestion) continue to read `locals.session`.
- Support token refresh and revocation to maintain long-lived sessions without re-prompting the user for credentials.

## Implementation Summary

- **Server-side client** – `src/lib/server/auth/oauth-client.ts` instantiates a singleton `NodeOAuthClient` with SQLite-backed state/session stores (`src/lib/server/auth/oauth-store.ts`). Tokens and DPoP keys stay on disk (`ATPROTO_OAUTH_STORE_FILE`).
- **Metadata endpoint** – `src/routes/client-metadata.json/+server.ts` serves the OAuth client metadata that Bluesky resolves via `ATPROTO_OAUTH_CLIENT_ID`.
- **Redirect endpoints** –
  - `src/routes/auth/login/+server.ts` validates the provided handle, requests an authorization URL from the OAuth client (which manages PKCE/state internally), and redirects the browser.
  - `src/routes/auth/callback/+server.ts` delegates state validation to the client library, completes the code exchange, hydrates an `Agent` to fetch the user’s handle, stores an OAuth-backed session cookie, and handles error redirects.
- **Session utilities** – `src/lib/server/session.ts` now models two session shapes (`legacy` and `oauth`), serializes OAuth sessions without exposing tokens, and keeps compatibility with existing credentials-based flows for development.
- **Twit action** – `src/routes/+page.server.ts` calls `createAuthenticatedAgent`, which transparently resumes either a legacy credential session or restores an OAuth session via the client. Legacy cookies are refreshed; OAuth cookies keep opaque identifiers while the tokens live in the SQLite store. Logout triggers `oauthClient.revoke` when appropriate.
- **UI** – `src/routes/+page.svelte` now opens `LoginPanel.svelte`, which collects the handle/DID and presents a “Continue with Bluesky” CTA while the main page retains the twit controls.

## Configuration

Add these variables to `.env` (see `README.md` for details):

| Variable | Description |
| --- | --- |
| `ATPROTO_OAUTH_CLIENT_ID` | Absolute URL that Bluesky resolves for the client metadata (e.g. `http://localhost:5173/client-metadata.json`). |
| `ATPROTO_OAUTH_REDIRECT_URI` | Comma-separated list of redirect URIs registered for the client (first entry is used when initiating login). |
| `ATPROTO_OAUTH_CLIENT_NAME` / `ATPROTO_OAUTH_CLIENT_URI` / `ATPROTO_OAUTH_POLICY_URI` / `ATPROTO_OAUTH_TOS_URI` / `ATPROTO_OAUTH_LOGO_URI` | Optional metadata fields exposed on `client-metadata.json`. |
| `ATPROTO_OAUTH_SCOPE` | Requested scope string, defaults to `atproto transition:generic`. |
| `ATPROTO_OAUTH_ALLOW_HTTP` | Set to `true` during local development to allow non-HTTPS issuers/redirects. |
| `ATPROTO_OAUTH_STORE_FILE` | SQLite file for OAuth state/session persistence (default `.data/oauth-store.sqlite`). |

## Flow Overview

1. The guest opens the login modal, enters a handle or DID, and presses “Continue with Bluesky”.
2. `/auth/login` asks the OAuth client for an authorization URL (state/PKCE handled by the library) and redirects the browser.
3. After completing the OAuth prompt, Bluesky redirects back to `/auth/callback` with `code` and `state`.
4. The callback lets `@atproto/oauth-client-node` validate state, exchanges the code, restores an `Agent`, and persists an OAuth session cookie containing only DID/handle metadata.
5. Subsequent server requests load the cookie, restore the OAuth session from the SQLite store, and act on the user’s behalf. Logout revokes tokens and clears both the store and cookies.
