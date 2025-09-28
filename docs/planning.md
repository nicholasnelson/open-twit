# Twit App (atweet) Planning Document

## 1. Project Overview
- **Objective**: Build a test application that lets authenticated AT Protocol users trigger a "twit" action (stateless, no textual payload) and view a global feed of recent twits.
- **Success Criteria**: Users can log in with existing AT Protocol credentials, fire a twit, and see an aggregated timeline of twits from all users with low latency (<5s) and acceptable reliability for a demo entirely in a local development environment.
- **Scope**: Client UI, minimal backend for feed aggregation, AT Protocol integration (PDS interactions plus feed generation). No native mobile apps, notifications, or moderation tooling in this initial iteration. Visual design will stay clean and functional without custom branding work.

## 2. Goals and Non-Goals
- **Goals**
  - Support authentication via existing AT Protocol accounts using app passwords.
  - Allow users to publish a "twit" that captures the user DID and timestamp.
  - Provide a global feed showing recent twits from all users.
  - Keep the app runnable via local development tooling without relying on cloud deployment.
- **Non-goals**
  - Rich media, comments, likes, or social graph features beyond the global feed.
  - Long-term persistence guarantees; acceptable to rely on PDS durability.
  - Comprehensive moderation, reporting, or advanced rate limiting (only minimal guardrails).
  - Offline support or native applications.

## 3. Key Assumptions
- Users already possess AT Protocol accounts and can generate app passwords.
- The app will use the `@atproto/api` SDK to interact with the PDS and repo records.
- We can define and publish a custom Lexicon schema for the `twit` record type under our own namespace (for example `com.atweet.twit`).
- The SvelteKit app will expose the global twit feed using the official feed generator spec.
- Local runtime will be Node.js with optional lightweight persistence (in-memory cache by default, with Redis/Postgres only if needed for future experiments).

## 4. User Experience and Flows
- **Authentication Flow**
  1. User opens the UI and enters handle plus app password.
  2. Client exchanges credentials for a session with the user's PDS (creates a `BskyAgent`).
  3. Session persists in local storage or in-memory until logout.
- **Twiting Flow**
  1. Authenticated user presses the "Twit" button; no text input is required.
  2. Client creates a `com.atweet.twit` record with minimal metadata (`createdAt` timestamp).
  3. Record is written to the user's repo via `agent.com.atproto.repo.createRecord`.
- **Global Feed Flow**
  1. Embedded feed generator module subscribes to AT Protocol Jetstream or polls for `com.atweet.twit` records.
  2. Module exposes an HTTPS endpoint conforming to the feed generator spec (cursor-based pagination).
  3. Client requests feed data and renders a list of users and timestamps.

## 5. System Architecture
- **Client (Web)**: SvelteKit front end handling auth form, twit action, and feed rendering.
- **Server Layer**: SvelteKit server routes host secure operations, including the embedded feed generator endpoints; optional caching layer (in-memory or Redis) to buffer latest twits for fast responses.
- **AT Protocol Components**: Custom Lexicon (`com.atweet.twit`), feed generator implementing `app.bsky.feed.getFeedSkeleton`, subscription to repo events to stay updated.

## 6. Data Model and Lexicon Draft
- **Record Name**: `com.atweet.twit`
- **Schema Draft**
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
- **Derived Feed Item**: Feed entries display author handle, DID fallback, and timestamp; no textual body.

## 7. Integration Points
- **Authentication**: Use `BskyAgent.login({ identifier, password })` on the client or via a server proxy (evaluate security trade-offs).
- **Create Twit**: Call `agent.com.atproto.repo.createRecord` with `collection: "com.atweet.twit"` and the minimal record payload.
- **Feed Generator**: SvelteKit server module consuming repo events, filtering records by collection, and maintaining cursor state.
- **Feed API to Client**: Expose a SvelteKit endpoint (for example `/api/feed`) that wraps the embedded feed generator logic and returns normalized data.
- **Lexicon Distribution**: Serve the `com.atweet.twit` lexicon JSON from a predictable SvelteKit static route (for example `/lexicons/com.atweet.twit.json`) so clients, tooling, and collaborators can reference it.

## 8. Implementation Plan (Phases)
- **Phase 0: Project Setup**
  - Initialize repository; configure linting, formatting, and testing baseline.
  - Scaffold the SvelteKit app and install dependencies (`@atproto/api`, data fetching utilities, UI toolkit).
  - Add `lexicons/com.atweet.twit.json` and configure SvelteKit static serving for lexicon files.
- **Phase 1: Auth and Session**
  - Build login form and session persistence (local storage or secure cookies).
  - Implement secure handling of app passwords (consider exchanging for session token server-side).
  - Add logout controls and informative error handling for auth failures.
- **Phase 2: Twit Action**
  - Create `TwitButton` component triggering record creation.
  - Handle optimistic UI updates and failure fallbacks.
  - Add simple client rate limiting (cooldown timer) to discourage spam.
- **Phase 3: Feed Generator Module**
  - Implement minimal feed generator within SvelteKit that filters `com.atweet.twit` records.
  - Support cursor pagination, reconnect logic, and lightweight caching.
  - Ensure endpoint security and configure any required CORS for external consumers.
- **Phase 4: Feed UI**
  - Build feed page that fetches from the embedded feed generator endpoint.
  - Display author handle, DID fallback, timestamp, and relative time.
  - Add auto-refresh polling and loading states.
- **Phase 5: Jetstream Integration & Persistence**
  - Replace the in-memory feed store with a repository that persists twits across restarts (SQLite or Redis).
  - Add a jetstream consumer that subscribes to `com.atproto.sync.subscribeRepos`, filters `com.atweet.twit` records, resolves author handles, and writes them to the repository.
  - Track jetstream cursor checkpoints to resume consumption without gaps and include reconnect/backoff logic.
  - Keep the `/api/feed` contract unchanged but back it with the persistent repository.
  - Expose configuration for jetstream endpoint and repository location via environment variables; provide scripts/docs for running the worker alongside the SvelteKit app.
- **Phase 6: Polish and Deployment**
  - **Phase 6.1: Auth Improvement (OAuth)**
    - Adopt the `@atproto/oauth-client-node` package and register an OAuth client with the chosen PDS/AppView.
    - Implement a SvelteKit server handler (`/auth/login`) that requests an authorization URL from the OAuth client and redirects the browser to the provider's authorization endpoint.
    - Add a callback route (`/auth/callback`) that delegates state validation to the OAuth client, exchanges the returned code for tokens, and persists the resulting ATProto session (server-side store + httpOnly cookie).
    - Update session management utilities to work with OAuth-issued tokens, including refresh flows and logout revocation.
    - Replace the form-based login UI with a "Sign in with Bluesky" button that kicks off the redirect sequence while preserving existing error/success feedback.
    - Cover the new auth flow with integration tests (mocking the OAuth client) and document required environment variables (`ATPROTO_OAUTH_CLIENT_ID`, `ATPROTO_OAUTH_REDIRECT_URI`, metadata fields) in `docs/auth-oauth.md` and the README.
  - **Phase 6.2: Production Styling & UX Polish**
    - Establish a cohesive visual language: define typography scale (primary sans + mono accent), spacing system, and a dark-first palette with accessible contrast and accent hues for actions/alerts.
    - Redesign the layout with a persistent header (logo, environment badge, quick links) and a responsive grid that stacks vertically on mobile while preserving the two-column experience on desktop.
    - Upgrade the authentication panel to a card with hero copy, contextual illustration/iconography, and clearly delineated call-to-action buttons/states.
    - Refresh the feed presentation: card-based items with author avatar/initials, handle + DID meta, time stamps, and subtle dividers; add skeleton/loading rows and empty-state messaging.
    - Standardize UI primitives (buttons, inputs, badges, alerts, toasts) with shared tokens and focus/hover states that pass WCAG contrast and keyboard navigation requirements.
    - Introduce motion affordances sparingly (e.g., fade/slide on form submit, skeleton shimmer, hover lifts) while respecting reduced-motion preferences.
    - Harden responsive behavior for breakpoints (≤640px, 641–1024px, ≥1025px) including typography scaling, padding adjustments, and sticky action areas on small screens.
    - Integrate accessibility enhancements: semantic headings hierarchy, aria-live for auth/twit status, larger touch targets, visible focus rings, and color-blind-safe status indicators.
    - Document design tokens and component guidelines (spacing, colors, fonts, elevations) to support future maintenance and team onboarding.
  - Apply clean, functional styling and responsive layout improvements.
  - Document local environment configuration and run scripts.
  - Perform smoke tests and manual QA with real AT Protocol accounts.
- **Future Enhancements**
  - Replace feed polling with push-based updates (Jetstream subscription or SSE) and reconcile local cache updates to minimize network churn.
  - Add "retwit" support, including UI controls, optimistic feedback, and Jetstream mirroring of retwit events.
  - Resolve and display user-friendly names by hydrating profile data (fallback to handle/DID); cache profile lookups to reduce fetch overhead.

## 9. Testing Strategy
- **Unit Tests**: Utility functions (datetime formatting, cooldown logic) covered with Jest or equivalent.
- **Integration Tests**: Mock `@atproto/api` to validate auth flow and record creation logic.
- **End-to-End Smoke**: Playwright or Cypress scenario executing login, twit action, and feed retrieval against staging services.
- **Manual QA**: Exercise app with real AT Protocol test accounts before demo.

## 10. Monitoring and Observability
- Server logs capture feed generator reconnect attempts, errors, and throughput metrics.
- Health check endpoint with optional uptime monitor ping.
- Basic client-side error logging surfaced in developer console during testing.

## 11. Risks and Mitigations
- **Feed Consistency**: Jetstream disconnects could cause gaps; mitigate with cursor persistence and backfill on reconnect.
- **Credential Handling**: Storing app passwords client-side is risky; prefer exchanging for short-lived server session tokens.
- **Rate Abuse**: Without limits, users could spam; add client cooldown and consider server-side throttling if needed.
- **Lexicon Distribution**: Need to host lexicon JSON so other services recognize it; ensure deployment bundles schema.

## 12. Open Questions
- Do we want additional metadata (for example client version) in the twit record for debugging?
- How should we resolve handles to DIDs if a user renames their handle after twiting?

## 13. Immediate Next Steps
1. Finalize local SvelteKit development environment configuration (tooling, ports, env vars).
2. Validate and publish the lexicon schema under the chosen namespace.
3. Scaffold repository structure for the SvelteKit app, embedded feed generator module, and shared utilities.
