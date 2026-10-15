# Setup & deployment

## Local development
See the [README](../README.md#quick-start-local). Useful scripts:

| Script | Purpose |
|---|---|
| `npm run dev -w @exammate/server` | API with live reload. Loads `apps/server/.env` if present, migrates and seeds on start. |
| `npm run migrate -w @exammate/server` | Apply SQL migrations only (idempotent, advisory-locked) |
| `npm run worker -w @exammate/server` | Standalone job worker (use with `RUN_WORKER_INLINE=false`) |
| `npm run dev -w @exammate/web` | Vite dev server on :5173 with `/api` proxied to :4000 |
| `npm run eval -w @exammate/server` | Benchmark suites (stored in `eval_runs`; exit code 1 on regression) |
| `npm run train:classifier -w @exammate/server` | Retrain the subject classifier from consented feedback (`… rollback` to revert) |

## Production build

```bash
npm ci
npm run build                     # core → server (dist/) → web (apps/web/dist, includes service worker)
cd apps/server && NODE_ENV=production node --env-file=.env dist/index.js
```

When `apps/web/dist` exists, the API also serves the web app from the same origin, so no CORS
setup is needed (override the location with `WEB_DIST`). Alternatively, serve `apps/web/dist`
from a CDN and add its origin to `APP_ORIGINS`.

### Required production settings
- `NODE_ENV=production`, `COOKIE_SECURE=true` and HTTPS everywhere. The server refuses to start
  without secure cookies, or with the development database password.
- `TRUST_PROXY=true` when running behind a reverse proxy, so rate limits see real client IPs.
- `MFA_ENCRYPTION_KEY`: 32 random bytes, base64. The server refuses to start in production
  without it. **Changing or losing it makes enrolled authenticator secrets unreadable**, and those
  users would then need recovery codes. Keep it in a secret manager and back it up.
- `RATE_LIMIT_STORE=postgres` (the default in production) shares rate-limit counters between
  instances through the `rate_limits` table. Use `memory` only for a single process.
- A dedicated PostgreSQL role with a strong password, backups, and TLS to the database.
- `STORAGE_DIR` on persistent, private storage. For multiple API nodes, replace
  `LocalDiskStorage` with an S3-compatible implementation of the `ObjectStorage` interface
  (`src/services/storage.ts`).
- Connect a real mail transport in `src/auth/mailer.ts`. Until then, emails are written to the
  `outbox_emails` table.
- Run `npm run worker` on separate instances with `RUN_WORKER_INLINE=false` on the API nodes if
  document volume is high.

### Container sketch
```Dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
RUN npm ci && npm run build
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["node", "--env-file-if-exists=.env", "apps/server/dist/index.js"]
```
(This Dockerfile is not part of the tested pipeline; validate it in your environment.)

## WebSockets (online multiplayer)

Multiplayer runs on the **same Node process and port** as the API, at the path `/ws`. No extra
service or SaaS is needed. Production requirements:

- **TLS:** clients use `wss://` whenever the API is HTTPS (derived automatically from the page or
  the mobile app's API URL).
- **Reverse proxy upgrade headers.** For nginx:
  ```nginx
  location /ws {
    proxy_pass http://exammate_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 120s;   # above the 30 s server heartbeat
  }
  ```
  Load balancers must allow WebSocket upgrades and an idle timeout above 30 s.
- **Origins:** browser connections must come from an origin listed in `APP_ORIGINS`; native apps
  send no Origin header and are accepted.
- **Single instance.** Rooms are authoritative in one process's memory and written through to
  PostgreSQL (`mp_rooms`), so a restart restores them, with game clocks paused for the downtime.
  Running several API instances is **not supported yet**: it needs sticky routing by room code or
  a shared pub/sub layer. Scale vertically or run a single API instance for now.
- **Settings:** `MP_ENABLED` (default `true`), `MP_TURN_SECONDS` (30), `MP_RECONNECT_GRACE_SECONDS`
  (60, after which a disconnected player forfeits or leaves the lobby), `MP_ROOM_IDLE_MINUTES`
  (15, abandoned rooms are then closed).
- Migrations `003_arcade.sql` and `004_multiplayer.sql` run automatically on start.
- In development, Vite's dev and preview servers proxy `/ws` to `:4000`.

## Static demo build
`npm run build:demo -w @exammate/web` writes `apps/web/dist-demo`: relative asset paths, in-memory routing,
no service worker and a demo banner. It runs without the API, so only on-device features work
(solver, tools, coach, offline and arcade games). Online multiplayer needs the server. Server features show a "needs the ExamMate server" note.

## Mobile
```bash
cd apps/mobile && npm install --no-workspaces
npx expo start                                     # development
npx expo export --platform android|ios             # JS bundle check (verified for both platforms in this build)
npx eas build -p android|ios                       # store builds (needs an Expo account; not run here)
```
Set the API URL in-app (**Settings → Server address**) or via `extra.defaultApiUrl` in
`app.json`. Production builds must use an HTTPS API.

## Local model (optional)
See [LOCAL_MODELS.md](LOCAL_MODELS.md).
