# Retwit Feature Specification

## 1. Overview
Retwits let authenticated users reshare an existing `com.atweet.twit` post so it appears near the top of the global timeline with clear attribution to the original author. This document outlines the UX flow, server contracts, persistence updates, and testing expectations for the initial release.

## 2. Goals
- Provide a lightweight reshare control that mirrors the immediacy of the existing `TWIT` action.
- Preserve the original author/handle in the timeline while showing who retwitted and when the reshare occurred.
- Reuse the current cooldown mechanics so users cannot spam twits or retwits.
- Store retwits in the local repository so pagination, Jetstream replay, and client refresh intervals continue to work without bespoke paths.

## 3. Non-Goals
- Adding commentary or quote retwits.
- Allowing edits to the original record.
- Surfacing retwits in dedicated tabs or filters beyond the primary feed.
- Cross-protocol resharing outside of `com.atweet.twit` subjects.

## 4. User Experience
1. Authenticated users see a `Retwit` button on each feed item.
2. Clicking the button submits a `?/retwit` POST with the target `uri`/`cid` in the form body.
3. While the action is pending, disable the button and show a `Resharing…` state.
4. On success, optimistically insert the retwit at the top of the feed with the following copy:
   - "Retwitted by {current handle}" label above the original twit content.
   - Original author metadata and timestamp remain unchanged.
   - A new relative timestamp for the retwit event ("Just now" on first render).
5. Display an aria-live announcement after success: "Retwit shared".
6. On failure, surface a toast/error message (reusing the twit feedback UI copy pattern).

### Guest Behaviour
- Guests do not see the `Retwit` button; clicking it should not be possible without a session.
- If a session expires mid-request, show the same "Your session expired" error used by the twit action.

## 5. Server Contracts
### Route
Create a new action handler on the landing page (or a dedicated `/retwit` endpoint depending on ergonomics):
- Method: POST (`?/retwit`).
- Payload: `{ uri: string; cid: string }` (form-encoded).
- Guards: Requires authenticated session; enforce the shared cooldown.

### Cooldown Policy
- Twits and retwits share the same 5-second cooldown window.
- When a user creates either action, set the `cooldownExpiresAt` to `now + 5s` and return it in the form state.
- If the cooldown is still active, return HTTP 429 with form feedback: "Cooldown active. Try again in {n}s.".

### Agent Interaction
- Resolve the existing twit record via `agent.com.atproto.repo.listRecords` if we need to verify the subject (optional for first cut; we can trust the client-provided URI/CID and let the AT Protocol return an error if invalid).
- Construct the retwit record:
  ```ts
  const record = {
    createdAt: new Date().toISOString(),
    subject: {
      uri: targetUri,
      cid: targetCid
    }
  };
  ```
- Call `agent.com.atproto.repo.createRecord` with collection `com.atweet.retwit`.

### Error Handling
- 401: Clear cookies and return the same session-expired feedback as twits.
- 429: Cooldown violation (share handler sets form message).
- 400: Missing URI/CID -> "Select a twit to retwit." message.
- Generic failure: "Failed to retwit. Please try again." (HTTP 500).

## 6. Data Model
### Lexicon
New record `com.atweet.retwit`:
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
      "subject": {
        "type": "object",
        "properties": {
          "uri": { "type": "string", "format": "uri" },
          "cid": { "type": "string" }
        },
        "required": ["uri", "cid"],
        "additionalProperties": false
      }
    },
    "required": ["createdAt", "subject"],
    "additionalProperties": false
  }
}
```

### Repository Storage
- Extend `TwitFeedItem` to include optional retwit metadata:
  ```ts
  type TwitFeedItem = {
    authorDid: string;
    authorHandle: string;
    cid: string;
    indexedAt: string;
    recordCreatedAt: string;
    uri: string;
    type: 'twit' | 'retwit';
    resharedByDid?: string;
    resharedByHandle?: string;
    subjectUri?: string;
    subjectCid?: string;
  };
  ```
- Update in-memory/sqlite repositories to persist the new fields.
- For SQLite, add a `type` column plus nullable `resharedByDid`, `resharedByHandle`, `subjectUri`, and `subjectCid` columns.
  - Migration: `ALTER TABLE twits ADD COLUMN ...` statements guarding against duplicates.
  - Ensure unique index still applies to `uri` to prevent duplicate retwits.
- Store retwits as their own feed rows so pagination works uniformly.

## 7. Feed API Contract
- The `/api/feed` endpoint should include a `type` field per item.
- For retwits, include a `resharedBy` object and the subject metadata:
  ```jsonc
  {
    "type": "retwit",
    "uri": "at://...",
    "cid": "...",
    "indexedAt": "...",
    "record": {
      "createdAt": "...",
      "subject": {
        "uri": "...",
        "cid": "..."
      }
    },
    "author": { "did": "...", "handle": "..." },
    "resharedBy": { "did": "...", "handle": "..." }
  }
  ```
- Twits continue to omit `resharedBy` and `subject` for a clean payload.
- Update `TwitFeed.svelte` to branch on `type` and show the planned UI copy.

## 8. Jetstream Integration
- When Jetstream is enabled, subscribe to both `com.atweet.twit` and `com.atweet.retwit` collections.
- Mirror remote retwits into the repository using the same schema.
- If the original twit is absent locally, we still add the retwit row; the UI should display a placeholder like "Original twit unavailable".

## 9. Cooldown & Rate Limiting
- Maintain a shared in-memory cooldown tracker keyed by DID.
- Each successful twit or retwit updates the cooldown timestamp.
- Subsequent actions (either type) must wait until the timestamp expires.

## 10. Accessibility & UI Copy
- `Retwit` button: `aria-label="Retwit {author handle}"` to aid screen readers.
- Announce success/failure through the existing feedback region.
- Ensure button focus states and disabled styles match the existing design tokens.

## 11. Testing Strategy
- **Unit**: Helpers that enforce cooldown and repository adapters for retwit fields.
- **Integration**: Server tests covering the `?/retwit` action (success, cooldown, invalid data, expired sessions).
- **Component**: `TwitFeed.svelte` spec to verify retwit rendering and button states.
- **End-to-end**: Optional Playwright happy path once we integrate the action.

## 12. Implementation Steps
1. Update repository types and migrations to store retwits.
2. Introduce the `com.atweet.retwit` lexicon file under `static/lexicons/` (or equivalent).
3. Add the `?/retwit` action with shared cooldown logic.
4. Extend `/api/feed` response and the client feed renderer.
5. Wire up the UI controls and optimistic updates.
6. Add Vitest coverage (repository + action + component).
7. Update documentation and README usage instructions.

## 13. Open Questions
- Should retwits appear in chronological order by retwit time even if the original twit is older? (Current assumption: yes.)
- Do we need a per-item retwit limit (e.g., prevent the same user from retwitting repeatedly)?
- Should the cooldown timer reset if a retwit mirrors the user’s own twit?

