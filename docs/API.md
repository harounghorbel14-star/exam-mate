# API reference

Base path: `/api`. JSON in and out, with request bodies validated by zod.

**Authentication** uses one of:
- the `em_session` httpOnly cookie (web), or
- an `Authorization: Bearer <token>` header (mobile).

**CSRF:** cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` requests must send
`x-exammate-client: 1`.

**Errors** use the shape `{ "error": { "code", "message", "details"? } }`.

| Status | Code |
|---|---|
| 400 | `validation_error` / `bad_request` |
| 401 | `unauthorized` |
| 402 | `premium_required` |
| 403 | `forbidden` |
| 404 | `not_found` (also returned for other users' resources) |
| 409 | `conflict` / `version_conflict` / `already_submitted` / `time_up` |
| 413 | `payload_too_large` |
| 423 | `assessment_mode` |
| 429 | `quota_exceeded` / `rate_limited` / `account_locked` (with `Retry-After`) |
| 503 | `ocr_unavailable` |

## Auth — `/api/auth`
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/register` | `{email, password (≥10), displayName, locale}` | Creates a session; queues a verification email in the outbox |
| POST | `/login` | `{email, password}` | Returns `{user, token, expiresAt}` and sets the cookie |
| POST | `/logout` | – | Revokes the current session |
| GET | `/me` | – | Current user |
| POST | `/verify-email` | `{token}` | Single-use |
| POST | `/request-password-reset` | `{email}` | Always 200 (no account enumeration) |
| POST | `/reset-password` | `{token, password}` | Single-use, 30 min; revokes all sessions |
| GET / DELETE | `/sessions`, `/sessions/:id` | – | List and revoke devices |

## Two-factor — `/api/auth/mfa` (signed in) and `/api/auth/login/mfa`
- `GET /api/auth/mfa` → `{enabled, enabledAt, recoveryCodesRemaining}`
- `POST /setup` with `{password}` → `{secret, otpauthUri}`. It stays pending until it is confirmed.
- `POST /enable` with `{code}` → `{enabled: true, recoveryCodes[10]}`. The codes are shown only once.
- `POST /disable` with `{password, code | recoveryCode}`
- `POST /recovery-codes` with `{code}` → a new set; the old set stops working.
- Login with 2FA on: `POST /api/auth/login` returns `{mfaRequired: true, challenge}`, with no
  session and no cookie. Then `POST /api/auth/login/mfa` with `{challenge, code | recoveryCode}`
  returns the normal login response. A challenge expires after 5 minutes or 5 wrong codes.

## Solving — `/api`
| Method | Path | Notes |
|---|---|---|
| POST | `/solve` | `{question, mode: short\|steps\|simple\|hint\|check\|similar\|translate, locale, studentAnswer?, targetLocale?, documentIds?, source?, save?}`. Returns the agent result: `status`, `engine` (`deterministic\|retrieval\|local-llm\|none`), `confidence` (`verified\|unverified\|unsupported`), `result` (answer, LaTeX, steps, verification, assumptions, warnings), `documentAnswer?`, `llmAnswer?`, `plan`, `traceId`, `usage`. Uses one AI quota unit; returns 423 in assessment mode. |
| POST | `/scan` | multipart `image` (PNG/JPEG/WebP ≤ 8 MB), `langs=eng,fra,ara` → `{text, confidence, questions[]}` |
| GET | `/questions?saved&bookmarked&limit&before&q` | Cursor pagination (`nextCursor`) |
| GET / PATCH / DELETE | `/questions/:id` | PATCH accepts `{saved?, bookmarked?, tags?}` |
| POST | `/solutions/:id/feedback` | `{helpful?, correctedSubject?, allowTraining, comment?}`. Question text is copied only when `allowTraining` is true. |

## Documents — `/api/documents`
| Method | Path | Notes |
|---|---|---|
| POST | `/` | multipart `file` + `title?, course?, exam?, subjectId?` → 202; processed in the background |
| GET | `/?limit&offset&subjectId&course&exam` | Paginated, with `total` |
| GET / PATCH / DELETE | `/:id` | DELETE removes the file, chunks and row |
| GET | `/:id/pages/:page` | Extracted text of one page |
| POST | `/:id/ask` | `{question}` → `{found, answer, engine, citations[{page, section, quote}], injectionWarnings}` |
| POST | `/:id/summary` | `{sentences}`; extractive, each item with page |
| POST | `/:id/flashcards` | `{max, save}`; `save` creates a deck |
| POST | `/:id/quiz` | `{count, seed}` |
| POST | `/:id/revision-sheet` | Premium |
| POST | `/:id/extract` | `{definitions[], formulas[]}` with pages |

## Flashcards — `/api/flashcards`
- `GET` / `POST /decks`, `DELETE /decks/:id`
- `GET` / `POST /decks/:id/cards`
- `PUT` / `DELETE /cards/:id`
- `GET /due?deckId&newLimit&max`
- `POST /cards/:id/review` with `{rating: again|hard|good|easy, elapsedMs}`
- `GET /offline-bundle`
- `POST /sync` with `{reviews:[{cardId, rating, at, elapsedMs}]}`; replays in time order and
  rejects future timestamps

## Exams — `/api/exams`
- `GET /topics`
- `POST /bank` (custom question), `GET /bank/mine`, `DELETE /bank/:id`
- `GET` / `POST` / `DELETE /templates`
- `POST /attempts` with `{subjects?, topics?, difficulty?, count, durationMinutes, seed?, strategyMode, locale, templateId?}`.
  Answers and rubrics are never sent while the attempt is in progress. Uses the exam quota.
- `GET /attempts`, `GET /attempts/:id`
- `PUT /attempts/:id/responses` (autosave; rejected 60 s after the deadline)
- `POST /attempts/:id/submit` → grades, summary and per-question time analysis.
  Responses sent after the deadline are ignored.
- `POST /attempts/:id/review` with `{questionId, pointsAwarded}` for manual marking

## Progress — `/api/progress`
- `POST /practice` with `{records[]}`
- `GET /weaknesses?days`
- `GET /plan?days`, `PUT /plan/overrides` with `{exclude, pin, minutesPerDay}`
- `GET /summary`
- `GET /games`, `POST /games/sync` with `{records: GameProgressRecord[]}` → conflict-free merge
- `GET /packs`, `GET /packs/:id` (content pack + SHA-256 of canonical JSON)
- `GET /arcade`, `POST /arcade/sync` with `{records: ArcadeStatsRecord[]}` → conflict-free merge (bests never regress; per-device counters). Unknown game ids and out-of-range values are rejected.

## Multiplayer — `/api/mp` and `/ws`
- `POST /api/mp/ticket` (auth) → `{ticket, expiresAt, path: "/ws"}`. Single use, valid 60 s, stored hashed.
- `GET /api/mp/rooms/:code` (auth) → `{room: {code, game, status, players, maxPlayers}}` for invite links (no identities).
- WebSocket `/ws`: the first message must be `{type: "auth", ticket}` within 5 s (else close code 4001).
  Then client messages, each with a unique action `id`: `create {game, maxPlayers}`, `join {code}`,
  `leave`, `ready {ready}`, `select {game, maxPlayers?}` (host), `kick {userId}` (host),
  `start` (host), `move {step, move}`, `rematch` (host), `ping`.
  Moves: `{cell}` (tic-tac-toe), `{col}` (Connect Four), `{from, path[]}` (checkers),
  `{choice: "rock"|"paper"|"scissors"}` (RPS), `{card}` (memory), `{tap: true}` (reaction),
  `{choice: index}` (trivia). `step` must equal the `view.step` the client last saw.
- Server messages: `welcome`, `room {room: RoomSnapshot}` (per-player view; hidden information removed),
  `ack {id, duplicate?}`, `error {id?, code, message}`, `left`, `pong`.
  Error codes: `unauthorized`, `bad_request`, `rate_limited`, `room_not_found`, `room_full`,
  `already_started`, `not_host`, `not_in_room`, `not_ready`, `not_enough_players`, `not_your_turn`,
  `illegal_move`, `stale`, `game_over`, `bad_move`, `kicked`.
- Close codes: 4001 unauthorized, 4008 rate limited, 4009 too many connections (5 per user).
  Messages are limited to 4 KB and ~6/s sustained (bursts of 30). Types live in
  `packages/core/src/multiplayer/protocol.ts`.

## Account — `/api/account`
- `GET` / `PUT /profile`, `GET` / `PUT /preferences`, `GET /usage`
- `GET /memory`, `PUT /memory`, `DELETE /memory/:id`, `DELETE /memory`
- Subjects: `GET /subjects`, `POST /subjects`, `DELETE /subjects/:id`
- Notes: `GET /notes`, `POST /notes`, `PUT /notes/:id`, `DELETE /notes/:id`.
  `PUT` needs `{title, body, version}` and returns 409 on a stale version.
- `GET /export` (JSON download), `DELETE /` with `{password}` (deletes the account and all
  data, cascading)

## Billing — `/api/billing` (test mode only)
- `GET /plans`, `GET /subscription`
- `POST /checkout` with `{plan: 'premium'}` → `{testMode: true, sessionId, amountCharged: 0}`
- `POST /test/confirm` with `{sessionId, acknowledgeTestMode: true}`
- `POST /cancel`

## Agent — `/api/agent`
- `GET /status` (public capability report; `externalAiApis: false`)
- `GET /hardware` (signed in)
- Admin only:
  - `GET /metrics`
  - `POST /eval`, `GET /eval/history`
  - `GET /classifier`, `POST /classifier/train`, `POST /classifier/rollback`

`GET /api/health` reports database status.
