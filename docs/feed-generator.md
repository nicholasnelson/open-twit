# Feed Generator Module

Phase 3 introduced the basic feed generator. With Phase 5, the module now supports external data by wiring Jetstream into the repository abstraction. The HTTP surface remains the same, but the storage and ingestion pipeline are ready for persistence.

## Components
- `src/lib/server/feed/store.ts`: Defines the `TwitRepository` contract, provides an in-memory implementation with deduplication, and exposes a factory for alternative backends.
- `src/lib/server/feed/jetstream.ts`: Establishes a Jetstream client (when enabled), listens for `com.atweet.twit` create events, and forwards them to the repository while tracking author handles.
- `src/lib/server/feed/cursor.ts`: Persists the latest Jetstream cursor to disk so the consumer can resume after restarts.
- `src/routes/+page.server.ts`: Persists locally created twits to the repository to keep the UI responsive ahead of Jetstream replication.
- `src/routes/api/feed/+server.ts`: Reads from the repository with optional `limit`/`cursor` query parameters and returns the JSON payload consumed by the UI.
- `src/lib/server/feed/store.spec.ts`: Vitest coverage for pagination, deduplication, and cursor handling in the in-memory repository.

## Request Flow
1. A user authenticates and fires a twit from the root page.
2. The server action writes the record via the PDS, mirrors it into the repository, and returns the URI/CID to the UI.
3. The Jetstream consumer (when enabled) receives the replicated commit, deduplicates it by URI, and updates the repository while persisting the latest cursor.
4. Clients request `/api/feed` with optional `cursor` and `limit` parameters. The endpoint responds with:
   ```jsonc
   {
     "cursor": "42",
     "items": [
       {
         "uri": "at://did:plc:user/com.atweet.twit/tid",
         "cid": "bafy...",
         "indexedAt": "2024-01-01T00:00:10.000Z",
         "record": {
           "createdAt": "2024-01-01T00:00:00.000Z"
         },
         "author": {
           "did": "did:plc:user",
           "handle": "user.test"
         }
       }
     ]
   }
   ```
5. Clients feed the returned cursor into subsequent requests to page through older entries.

## Caching & Persistence Strategy
- The in-memory repository retains the 500 most recent twits; swapping to a persistent backend only requires a new `TwitRepository` implementation.
- Entries are deduplicated by URI to avoid double writes when both the local action and Jetstream emit the same record.
- Jetstream cursors are flushed to `JETSTREAM_CURSOR_FILE` (default `.jetstream-cursor`) on a short debounce so restarts continue from the last processed event.
- The API sets `Cache-Control: private, max-age=2` to keep the UI responsive while allowing quick refreshes.

## Configuration
- `JETSTREAM_ENABLED` (default `false`): Enable the Jetstream consumer.
- `JETSTREAM_ENDPOINT` (default `wss://jetstream1.us-east.bsky.network/subscribe`): Jetstream WebSocket endpoint.
- `JETSTREAM_CURSOR` (optional): Initial cursor (microseconds). Overrides any persisted cursor file.
- `JETSTREAM_CURSOR_FILE` (default `.jetstream-cursor`): File path used to persist the latest cursor.

## Extensibility Notes
- Replace the in-memory repository with SQLite, PostgreSQL, or Redis by implementing the same interface and wiring it into the factory.
- Extend the Jetstream consumer to handle updates/deletes or additional collections by registering more listeners before calling `start()`.
- Cursor persistence currently writes to a local file; swap the implementation for a shared datastore when running multiple replicas.
- The feed JSON mirrors the AT Protocol feed generator skeleton, simplifying a future upgrade to the official spec.
