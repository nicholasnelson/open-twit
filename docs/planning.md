# Twit App (atweet) Planning Document

## 1. Project Overview
- **Objective**: Deliver a compact SvelteKit playground that lets AT Protocol users authenticate with OAuth, fire stateless "twits", reshare posts via "retwits", and review a global feed backed by a local repository.
- **Current Capabilities**: OAuth-based sign-in, a cooldown-protected twit action, feed pagination with automatic refresh, optional Jetstream ingestion, and SQLite-backed persistence for both feed data and OAuth state. Retwit support is planned.
- **Scope**: Continue sharpening the web experience and server-side plumbing that support the demo. Skip mobile clients, social graph features, or moderation tooling until the core loop (twits + retwits) is rock solid.

## 2. Goals and Non-Goals
- **Goals**
  - Keep authentication centered on OAuth while retaining legacy app-password support for development fallback.
  - Ensure the twit action mirrors new records into the local repository immediately for fast UI feedback.
  - Maintain a globally visible feed with cursor pagination, deduplication, and low-latency refresh.
  - Introduce retwits that let authenticated users reshare existing feed items while crediting the original author and preserving cooldown rules.
  - Ship everything in a local-friendly stack (SQLite, file-based cursors, no extra services required by default).
- **Non-goals**
  - Rich authoring (text, images), threading, or interactions beyond the simple twit gesture.
  - Quote-style retwits with custom commentary or inline editing.
  - Multi-region availability or heavy-duty persistence guarantees beyond what SQLite + Jetstream replay provide.
  - Advanced abuse mitigation or moderation workflows; stick to lightweight cooldowns for now.
  - Offline-first behaviour, push notifications, or native desktop/mobile shells.

## 3. Key Assumptions
- Collaborators already have AT Protocol accounts and can grant OAuth access to the configured client.
- The app continues to rely on `@atproto/api` for repo writes and the Jetstream WebSocket for remote ingestion.
- `com.atweet.twit` remains the shared schema; consumers can fetch it from `/lexicons/com.atweet.twit.json`.
- Retwits target existing `com.atweet.twit` records and reuse the same repository for storage.
- Local runs target Node.js, with SQLite files stored in `.data/` and Jetstream disabled unless explicitly requested.

## 4. User Experience and Flows
- **Authentication Flow**
  1. Guests tap `Log in`, which opens the `LoginPanel` modal.
  2. The panel collects a handle or DID and redirects through `/auth/login` to the provider using OAuth.
  3. `/auth/callback` persists a cookie (`mode: 'oauth'`) and refreshes the page; returning users skip the modal entirely.
- **Twit Flow**
  1. Authenticated users press the prominent `TWIT` button.
  2. The `?/twit` action resumes the session, writes the `com.atweet.twit` record, updates cookies if necessary, and mirrors the entry into the repository.
  3. The action returns success metadata plus a five-second cooldown window; the UI disables the button and shows a countdown until it expires.
- **Feed Flow**
  1. `TwitFeed.svelte` loads `/api/feed?limit=20`, showing skeleton rows during the initial request.
  2. A five-second interval re-fetches the first page and prepends unseen entries while a one-minute timer refreshes relative timestamps.
  3. Users can page backward with `Load more`, which fetches by cursor and merges older items without duplicates.
- **Retwit Flow (planned)**
  1. Authenticated users click a `Retwit` control on a feed item.
  2. The `?/retwit` action validates cooldown status, resumes the session, and writes a `com.atweet.retwit` record referencing the original twit URI/CID.
  3. The action mirrors the retwit into the local repository and updates the feed so the reshare appears inline with attribution.

## 5. System Architecture
- **Client**: Svelte-driven UI components for auth modal management, cooldown timers, feed rendering, and retwit affordances.
- **Server**: SvelteKit load/actions for auth + twit flows, planned retwit endpoints, feed API responses, and Jetstream bootstrapping via `hooks.server.ts`.
- **Persistence**: SQLite repository for feed items and retwits (`TWIT_REPOSITORY_DRIVER=sqlite`) and OAuth session data (`ATPROTO_OAUTH_STORE_FILE`), both defaulting to project-relative paths.
- **Protocols**: `@atproto/api` handles repo writes; `@skyware/jetstream` streams remote commits when enabled (retwit commits included once implemented).

## 6. Data Model and Lexicon
- **Record Names**: `com.atweet.twit`, `com.atweet.retwit`
- **Schema**:
  ```jsonc
  {
    "lexicon": 1,
    "id": "com.atweet.twit",
    "type": "record",
    "key": "twit",
    "record": {
      "type": "object",
      "description": "Represents a single stateless twit action",
      "properties": {
        "createdAt": { "type": "string", "format": "datetime" }
      },
      "required": ["createdAt"],
      "additionalProperties": false
    }
  }
  ```
- **Retwit Schema (planned)**:
  ```jsonc
  {
    "lexicon": 1,
    "id": "com.atweet.retwit",
    "type": "record",
    "key": "retwit",
    "record": {
      "type": "object",
      "description": "References an existing twit for resharing",
      "properties": {
        "createdAt": { "type": "string", "format": "datetime" },
        "subjectUri": { "type": "string", "format": "uri" },
        "subjectCid": { "type": "string" }
      },
      "required": ["createdAt", "subjectUri", "subjectCid"],
      "additionalProperties": false
    }
  }
  ```
- **Feed Projection**: Stored items capture DID, preferred handle, URI, CID, twit timestamp, and repository insertion time.
- **Retwit Projection (planned)**: Extend stored items with the resharing DID, target URI/CID, and a pointer to the original feed entry for quick lookup.

## 7. Integration Points
- **OAuth**: `src/routes/auth/login/+server.ts` and `src/routes/auth/callback/+server.ts` orchestrate redirects through `NodeOAuthClient`.
- **Session Handling**: `src/lib/server/session.ts` serializes cookies for both OAuth and legacy app-password sessions.
- **Twit Action**: `src/routes/+page.server.ts` resumes the agent, writes the record, refreshes cookies, and pushes the entry into the repository.
- **Retwit Action**: `src/routes/+page.server.ts` resumes the agent, records the retwit, enforces cooldown parity, and mirrors the reshare locally.
- **Repository Access**: `src/lib/server/feed/store.ts` exposes the shared repository; SQLite is the default driver with an in-memory alternative for tests.
- **Feed API**: `src/routes/api/feed/+server.ts` normalizes cursor/limit params and returns the payload consumed by `TwitFeed`, including retwit enrichment and attribution.
- **Jetstream Consumer**: `src/lib/server/feed/jetstream.ts` subscribes to remote events, reconciles handles, and persists commits when `JETSTREAM_ENABLED=true`.

## 8. Implementation Status and Roadmap
- **Completed**
  - Project scaffold, linting, formatting, and Vitest integration.
  - OAuth-based sign-in flow with SQLite-backed token storage and logout revocation.
  - Cooldown-aware twit action with immediate repository mirroring.
  - Feed endpoint with pagination, dedupe logic, and SQLite persistence.
  - Optional Jetstream consumer wired through the global SvelteKit hook.
  - Retwit reshare flow with shared cooldowns, repository persistence, and feed/UI integration.
- **Upcoming Focus**
  - Align automated tests (`page.svelte.test.ts`, repository specs) with the latest UI copy and OAuth flow.
  - Expand repository tooling (migration scripts, health checks) for production-style deployments.
  - Introduce richer empty/error states and analytics hooks without regressing performance.
  - Document operational runbooks for enabling Jetstream in multi-instance environments.

## 9. Testing Strategy
- **Unit Tests**: Vitest coverage for utilities (`src/lib/utils/datetime`), repository helpers, cooldown timers, and forthcoming retwit utilities.
- **Component/System Tests**: `@vitest/browser` suites targeting `+page.svelte` and feed interactions with mocked fetch responses, extended to cover retwit affordances.
- **Integration Smoke**: Server-side tests that mock `@atproto/api` and OAuth restore paths to exercise the twit and retwit actions end-to-end.
- **Manual QA**: Periodically validate with real AT Protocol accounts, especially after OAuth, Jetstream, or retwit-related changes.

## 10. Monitoring and Observability
- Server logs capture Jetstream lifecycle events, repository persistence issues, and OAuth revocation failures.
- Consider a lightweight health endpoint once the app is deployed beyond local machines.
- Surface client errors via console warnings during development; keep production telemetry optional for now.

## 11. Risks and Mitigations
- **Jetstream Drift**: Connection drops can create gaps; persist cursors (`JETSTREAM_CURSOR_FILE`) and replay on reconnect.
- **OAuth Configuration**: Misconfigured redirect URIs or metadata break sign-in; keep `.env` templates and docs accurate.
- **Session Expiry**: Expired tokens force re-auth; defensive handling already clears cookies and prompts re-login.
- **Abuse/Spam**: The five-second cooldown is minimal; be prepared to layer server-side rate limiting if public traffic grows.
- **Retwit Misuse**: Rapid resharing can amplify spam; reuse cooldown enforcement and consider per-session retwit limits or dedupe rules.

## 12. Open Questions
- Should the repository retain additional metadata (client version, localized timestamps) for debugging?
- How should we surface remote Jetstream failures in the UI without overwhelming casual testers?
- Do we keep legacy app-password support indefinitely or gate it behind a development flag?
- How do we surface attribution for retwits when the original twit is missing or deleted?
- Should retwits share the twit cooldown or maintain an independent limit?

## 13. Immediate Next Steps
1. Refresh documentation/tests that still reference the retired app-password form or outdated UI copy.
2. Publish operational notes for enabling Jetstream and managing the SQLite stores in shared environments.
3. QA the retwit flow end-to-end (manual + automated) and log follow-up work for edge cases.
4. Audit accessibility (focus states, aria-live regions) and capture follow-up work in `docs/feed-ui.md`.
