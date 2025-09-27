# atweet

Experimental SvelteKit app for testing the AT Protocol by firing "twits" (stateless actions) and browsing a global feed.

## Getting Started

1. Copy the example environment file and adjust values if you are targeting a different PDS:
   ```sh
   cp .env.example .env
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the local development server:
   ```sh
   npm run dev -- --open
   ```
   The app runs on <http://localhost:5173> by default, and the custom lexicon is served from <http://localhost:5173/lexicons/com.atweet.twit.json>.

## Available Scripts

- `npm run dev` – start the Vite development server.
- `npm run build` – create a production build.
- `npm run preview` – preview the production build locally.
- `npm run lint` – run Prettier and ESLint.
- `npm run check` – perform type and Svelte checks.
- `npm run test` – execute Vitest unit tests.

## Environment Variables

| Variable              | Description                                                                                  | Default                                            |
|-----------------------|----------------------------------------------------------------------------------------------|----------------------------------------------------|
| `ATP_PDS_URL`         | Base URL of the AT Protocol PDS used for authentication and writes.                          | `https://bsky.social`                              |
| `JETSTREAM_ENABLED`   | Set to `true` to connect to Jetstream and ingest remote twits.                               | `false`                                            |
| `JETSTREAM_ENDPOINT`  | Jetstream WebSocket endpoint.                                                                | `wss://jetstream1.us-east.bsky.network/subscribe`  |
| `JETSTREAM_CURSOR`    | Optional microsecond cursor to resume Jetstream consumption (overrides the cursor file).     | _unset_                                            |
| `JETSTREAM_CURSOR_FILE` | File path used to persist the latest Jetstream cursor between restarts.                    | `.jetstream-cursor`                                |

## Notes

- The `static/lexicons/com.atweet.twit.json` file defines the custom `com.atweet.twit` record schema and is automatically available from `/lexicons/com.atweet.twit.json` when the dev server is running.
- Use AT Protocol app passwords when signing in; the app never stores the raw password, only the resulting session tokens in an HTTP-only cookie during development.
- See [docs/login-flow.md](docs/login-flow.md) for a step-by-step explanation of the authentication flow.
- See [docs/twit-action.md](docs/twit-action.md) for the Phase 2 twit action mechanics and cooldown behaviour.
- See [docs/feed-generator.md](docs/feed-generator.md) for details on the Phase 3 feed module and API endpoint.
- See [docs/feed-ui.md](docs/feed-ui.md) for the Phase 4 feed experience and UI behaviour.
- Jetstream integration is disabled by default. Enable it by exporting `JETSTREAM_ENABLED=true` in your environment.
