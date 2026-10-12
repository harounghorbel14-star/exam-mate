# ExamMate AI

A private study companion for students: a **verified step-by-step solver**, **Smart Scan** (OCR),
**document study tools with page citations**, **practice exams**, **spaced-repetition flashcards**,
a **weakness detector**, an **exam strategy coach**, **15 offline educational games**, an
**Arcade of 15 entertainment games** (all offline) and **online multiplayer** with 2–4 players. It ships as a web app
(installable PWA), an Expo mobile app (Android/iOS), and a Node/PostgreSQL API.

ExamMate's "AI" is its own agent. It does **not** call OpenAI, Anthropic, Gemini or any hosted
inference API. Answers come from three sources, in this order:

1. deterministic tools (math, units, physics formulas, chemistry), which verify their own results;
2. retrieval over the user's own documents, which answers with page citations;
3. an optional local open-weight model (llama.cpp). Its answers are always marked *unverified*.

If none of these can answer, ExamMate says so instead of guessing.

> Status: working, tested build. See [docs/FEATURES.md](docs/FEATURES.md) for the
> feature-by-feature matrix and [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for what is not done.

## Repository layout

```
packages/core      Shared TypeScript domain logic (web, mobile and server):
                   math/science/chemistry engines, local solver, SRS, grading, weakness detector,
                   sync/merge, i18n (en/fr/ar), subject classifier, 15 educational game engines + bundled
                   content, 15 arcade game engines, multiplayer protocol/rules/client
apps/server        Express + PostgreSQL API, background jobs, OCR, retrieval, billing (test mode),
                   WebSocket multiplayer rooms (/ws)
  src/agent/       The ExamMate agent: core loop, planner, reasoning, tools, memory, knowledge,
                   models (local runtimes), training, evaluation, security, observability
apps/web           React + Vite PWA (all 9 sections plus Quick Tools and Exam Coach)
apps/mobile        Expo / React Native app (kept outside npm workspaces; own node_modules)
docs/              Architecture, API, deployment, security, local models, features, limitations
```

## Quick start (local)

Prerequisites: Node.js ≥ 20 (22 recommended), PostgreSQL 14+.

```bash
npm install                      # installs core, server and web (workspaces)
npm run build -w @exammate/core

# Database
createuser exammate -P           # choose a password
createdb exammate -O exammate
cp apps/server/.env.example apps/server/.env   # set DATABASE_URL

# API (migrates and seeds on start) → http://localhost:4000
npm run dev:server

# Web app → http://localhost:5173 (proxies /api to :4000)
npm run dev:web
```

Mobile (from `apps/mobile`):

```bash
cd apps/mobile && npm install --no-workspaces
npx expo start          # scan the QR code with Expo Go, or press a / i for an emulator
```

Set the API address in the app's **Settings → Server address**. The default is
`http://10.0.2.2:4000` (the Android emulator's alias for the host machine).

## Tests

| Command | What it runs |
|---|---|
| `npm test -w @exammate/core` | 211 unit tests: engines, educational and arcade games, multiplayer rules, SRS, sync, i18n parity, classifier gate |
| `npm test -w @exammate/server` | 78 integration tests against a real PostgreSQL test DB (`exammate_test`), real OCR, the real llama.cpp runtime and real WebSocket clients |
| `npm test -w @exammate/web` | 10 component tests (jsdom) |
| `npm run e2e` | 27 Playwright tests: the original 6, all 15 arcade games played in the browser, and multiplayer between independent browser clients |
| `npm run test:mobile` | 24 Jest tests rendering mobile screens (solver, games, arcade, online play, tools, coach, exams) |
| `npm run eval` | Agent benchmark suites; stores the run and fails on regressions |

Current measured results are in [docs/TESTING.md](docs/TESTING.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Setup & deployment](docs/DEPLOYMENT.md)
- [Local models & hardware profiles](docs/LOCAL_MODELS.md)
- [Security checklist](docs/SECURITY.md)
- [Feature-completion matrix](docs/FEATURES.md)
- [Testing & evaluation results](docs/TESTING.md)
- [Known limitations](docs/LIMITATIONS.md)
