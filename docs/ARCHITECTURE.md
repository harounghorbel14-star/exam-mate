# Architecture

## Overview

```
 ┌───────────── Web PWA (React/Vite) ─────────────┐   ┌──── Mobile (Expo/RN) ────┐
 │ pages · offline games · local solver · tools   │   │ screens · games · solver │
 │ IndexedDB/localStorage queues · service worker │   │ AsyncStorage · SecureStore│
 └──────────────┬─────────────────────────────────┘   └─────────────┬────────────┘
                │            @exammate/core (shared TypeScript)      │
                │  math/units/physics/chem engines · local solver ·  │
                │  SRS · grading · weakness · sync merge · i18n ·    │
                │  subject classifier · 15 game engines + content    │
                └──────────────────────┬──────────────────────────────┘
                                       │ HTTPS JSON (cookie or Bearer)
                ┌──────────────────────▼───────────────────────────────┐
                │ apps/server (Express)                                │
                │  auth · ownership checks · quotas · uploads · jobs   │
                │  agent/ core · planner · tools · memory · knowledge  │
                │         models · training · evaluation · security    │
                │         observability                                │
                │  OCR: tesseract.js + bundled language data           │
                │  Local LLM (optional): node-llama-cpp / llama-server │
                └──────────────────────┬───────────────────────────────┘
                                       │
                  PostgreSQL (data, FTS retrieval index, jobs) + object storage (files)
```

## Shared core (`packages/core`)

The same code runs in the browser, in React Native and on the server, so offline answers and
online answers come from identical logic.

- **Math engine:** a sandboxed mathjs parse with a blocklist that rejects `import`, `evaluate`,
  assignments and property access. It solves linear and quadratic equations with exact surds,
  higher-degree polynomials (Durand–Kerner), transcendental equations (bisection) and linear
  systems with exact fractions. It also covers derivatives, polynomial antiderivatives,
  adaptive-Simpson integrals and statistics.
- **Independent verification:** every result is checked a second way. Solutions are substituted
  back into the original equation, expressions are re-evaluated at 40-digit precision,
  derivatives are checked by finite differences, integrals are checked numerically, unit
  conversions are round-tripped, and chemistry balances are checked by atom and charge counts.
- **Science:** unit conversion and dimension checks (mathjs units). A physics formula library
  chains up to three formulas. A word-problem parser extracts quantities with units in
  en/fr/ar.
- **Chemistry:** all 118 elements with trilingual names. A formula parser handles groups,
  hydrates and charges, molar mass is computed, and equations are balanced through the exact
  rational null space.
- **Local solver:** routes a question to a tool, renders modes (short, steps, simple, hint,
  check, similar) and localises step text. If no tool fits, it returns `unsupported`; it never
  fabricates an answer.
- **Learning:** SM-2 spaced repetition, exam building and grading (written answers always go
  to manual review), a weakness detector with explanations, and study plans that respect user
  overrides.
- **Sync:** last-write-wins collections. Game progress merges conflict-free: maximum for
  monotonic fields, union of stars, and per-device G-counters.
- **i18n:** a typed dictionary. Parity across en/fr/ar and placeholder consistency are
  enforced by tests. RTL handling and LTR isolation for math are included.
- **Games:** 15 definitions with seeded generators, quiz and memory engines, scoring
  (base + speed + streak), stars, level unlocking, and a local repository with a dirty-tracking
  sync queue.

## Server (`apps/server`)

- **HTTP:** helmet (CSP), a CORS allowlist, JSON limits, rate limits (global, auth, solve),
  CSRF header for cookie sessions, zod validation everywhere, and structured errors.
- **Auth:** scrypt password hashing, random session tokens stored as SHA-256, httpOnly
  SameSite=Lax cookies for the web, Bearer tokens for mobile, single-use email verification and
  reset tokens, and session revocation.
- **Data:** PostgreSQL. Every user-owned table has `user_id … ON DELETE CASCADE`, and every
  query filters by the authenticated owner (tested in `authz.test.ts`).
- **Documents:** content-sniffed validation (PDF/DOCX/TXT/MD only), private storage with safe
  keys, and a background job (`jobs` table, `FOR UPDATE SKIP LOCKED`, retries with backoff)
  that extracts text, chunks it with section headings, and indexes it in a Postgres `tsvector`
  (GIN).
- **Retrieval:** an OR-prefix tsquery for recall, re-ranked by term coverage and scoped to the
  user. Only the top chunks are used, never whole documents.
- **OCR:** tesseract.js (WASM) with language data from npm packages, serialised, with a
  timeout. The web app has an in-browser fallback using the same assets served from its own
  origin.

## The agent (`apps/server/src/agent`)

| Folder | Responsibility |
|---|---|
| `core/runner.ts` | Execution loop: classify → plan → execute permitted tools → inspect → verify → explain. Hard limits on steps, wall-clock time and retries; caller cancellation. |
| `planner/` | Chooses a strategy: deterministic tool → user documents → local model → honest "unsupported". |
| `reasoning/` | Structured-output validation (zod) for model answers, plus number-preservation checks when a model rephrases a verified answer. |
| `tools/` | Tool registry with input schemas and permission classes granted by the caller (never by model output). |
| `memory/` | User-controlled learning memory: list, edit, delete, delete all. Inferred items expire after 180 days, and sensitive-looking data is never stored. |
| `knowledge/` | RAG over the user's documents. Extractive answers with page citations; model citations are validated against retrieved chunks. |
| `models/` | Local runtimes: node-llama-cpp (in-process GGUF with SHA-256 verification) and a loopback-only llama-server adapter; hardware profiles. |
| `training/` | Re-fits the Naive Bayes subject classifier on consented feedback, gates promotion on held-out accuracy (no regression), and supports rollback through the model registry. |
| `evaluation/` | Versioned benchmark datasets (math, science, multilingual, verification, grounding) and a regression gate. |
| `security/` | Prompt-injection detection and fencing, budgets and timeouts. |
| `observability/` | Privacy-respecting traces (input hash only), p50/p95 latency, and tool failure metrics. |

### What "learning" means here

- **Memory:** preferences, level, subjects and studied concepts. These are stored only with
  the user's consent and can be edited or deleted.
- **Retrieval improvements:** new documents are indexed immediately.
- **Model-weight training:** the subject classifier is genuinely re-trained from consented
  corrections, evaluated, and promoted or rejected automatically, with rollback.
- **No self-modification:** the LLM's weights are not trained by the app, and nothing rewrites
  its own code.

## Clients

- **Web:** routes are lazily loaded. The service worker precaches the app shell, the games, the
  solver and the tools; OCR assets are cached on first use. Offline queues (flashcard reviews,
  practice records, dirty game progress) flush automatically when connectivity returns.
- **Mobile:** bottom tabs and a stack navigator, AsyncStorage for offline data, and SecureStore
  for the token. Camera and library access go through expo-image-picker, and permission is
  requested only on tap.

## Arcade and online multiplayer

- `packages/core/src/arcade/` holds the 15 entertainment games as pure, deterministic engines
  (seeded `mulberry32`; time passed in by the caller), the trilingual catalogue, and
  `ArcadeRepository` (stats, favourites, recents, settings, saved games) over the same
  `KeyValueStore` used by the educational games. It is separate from `src/games/` so the
  educational games and their sync format are untouched.
- Web (`apps/web/src/arcade`, `pages/Arcade*.tsx`) and mobile (`apps/mobile/src/arcade`,
  `screens/ArcadeScreen.tsx`) render the same engines; each game is its own lazy chunk on web and
  is precached by the service worker.
- `packages/core/src/multiplayer/` contains the protocol types and validator, the
  server-authoritative rules (`mpInit`, `mpApply`, `mpTick`, `mpView`) reusing the arcade engines,
  and `MultiplayerClient` (ticket auth, ack tracking, auto-reconnect and rejoin) used by both web
  and React Native.
- `apps/server/src/multiplayer/`: `tickets.ts` (single-use socket credentials), `rooms.ts`
  (`RoomManager`: lobby, seats, host migration, timers, grace periods, sweeping, write-through
  persistence and restore) and `ws.ts` (upgrade handling on the existing HTTP server, origin check,
  rate limiting, heartbeat).

