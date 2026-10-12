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
