# Feed Generator Module

Phase 3 introduces an in-memory feed generator that collects `com.atweet.twit` records and exposes them through a cursor-based endpoint compatible with future AT Protocol feed generator work.

## Components
- `src/lib/server/feed/store.ts`: Maintains a bounded in-memory buffer of the most recent twits, supports cursor pagination, and clamps limits to reasonable defaults.
- `src/routes/+page.server.ts`: After each successful twit write, the action appends the new record to the feed store so the feed reflects the latest activity without polling the PDS.
- `src/routes/api/feed/+server.ts`: Provides a JSON API that returns twit entries ordered newest-first with optional `limit` and `cursor` query parameters.
- `src/lib/server/feed/store.spec.ts`: Vitest coverage for the store’s pagination logic to guard against regressions.

## Request Flow
1. A user authenticates and fires a twit from the root page.
2. The server action persists the record via the PDS, refreshes the session cookie, and forwards the resulting URI/CID plus author metadata to the feed store.
3. Clients request `/api/feed` with optional `cursor` and `limit` parameters. The handler reads from the store and returns:
   ```jsonc
   {
     "cursor": "42",            // null when the end of the buffer is reached
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
4. Clients feed the returned cursor into the next request to page through older entries.

## Caching Strategy
- The feed store keeps the most recent 500 twits in memory, trimming older entries automatically.
- The API sets `Cache-Control: private, max-age=2`, hinting browsers to reuse responses briefly while keeping the feed fresh.

## Extensibility Notes
- Replace the in-memory store with a persistent cache (Redis, SQLite, etc.) by swapping the store implementation behind the same interface.
- The endpoint payload already maps closely to the AT Protocol feed generator skeleton. When ready to integrate with the official spec, wrap the store reads in the necessary lexicon envelope.
- Hooking the store up to a firehose subscriber will let the feed display twits from other users once the infrastructure is ready.
