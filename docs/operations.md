# Operations

This guide covers the minimal operational tasks required when running atweet beyond local development, focusing on Jetstream ingestion and the SQLite-backed stores used for feeds and OAuth sessions.

## Jetstream Ingestion

### Enable the Worker
1. Export the environment variables before starting SvelteKit:
   ```bash
   export JETSTREAM_ENABLED=true
   export JETSTREAM_ENDPOINT=wss://jetstream1.us-east.bsky.network/subscribe
   export JETSTREAM_CURSOR_FILE=.data/jetstream-cursor
   ```
   Adjust the endpoint if you run a custom relay. Relative paths are resolved from the project root.
2. Start the app (`npm run dev` or `npm run build && npm run preview`). `src/hooks.server.ts` kicks off `startJetstreamConsumer` in-process.

### Monitor Runtime State
- Successful connections log `Jetstream connected` with the active cursor. Watch stdout/stderr for reconnect warnings and cursor persistence messages.
- The consumer persists the latest cursor to `JETSTREAM_CURSOR_FILE` with a small debounce; verify the file updates by inspecting its modification time.
- To replay from scratch, delete the cursor file and unset `JETSTREAM_CURSOR` before restarting.

### Handling Failures
- Transient network errors emit `Jetstream error`; the worker retries automatically. Persistent failures typically mean the endpoint is unreachable or credentials are invalid.
- When multiple app instances run, ensure each uses a distinct cursor file location to avoid contention, or centralise cursor storage with a shared filesystem.

## SQLite Stores

The project uses SQLite for two concerns:
- Feed repository: defaults to `.data/twits.sqlite` (configurable via `TWIT_REPOSITORY_FILE`).
- OAuth session/state store: defaults to `.data/oauth-store.sqlite` (`ATPROTO_OAUTH_STORE_FILE`).

### Managing the Files
- Create the `.data/` directory before first run in production environments to ensure write permissions:
  ```bash
  mkdir -p .data
  chown <app-user>:<app-group> .data
  ```
- Both stores use WAL mode. Keep them on a persistent volume if containers are recycled.

### Backups and Rotation
- The feed repository is a cache of recent items; you can take periodic snapshots or simply allow Jetstream replay to rebuild it. Use `sqlite3 .data/twits.sqlite '.dump'` for ad-hoc exports.
- The OAuth store contains refresh tokens. Treat it like a secret: restrict filesystem permissions and include it in backups if you want session continuity. Revoking tokens after a restore may be necessary depending on your rotation policy.

### Maintenance Tasks
- To clear the feed repository without touching OAuth data:
  ```bash
  sqlite3 .data/twits.sqlite 'DELETE FROM twits; VACUUM;'
  ```
- To reset OAuth state (for example, when recycling credentials):
  ```bash
  rm -f .data/oauth-store.sqlite
  ```
  Users will be prompted to sign in again on the next action.

### Observability Hooks
- Add filesystem alerts for unexpected growth of either file. The feed store trims itself to ~500 entries, so a much larger size may indicate a misconfiguration.
- Surface health probes by reading the SQLite files with `sqlite3` in a cron job or custom monitoring script if you need higher assurance.
