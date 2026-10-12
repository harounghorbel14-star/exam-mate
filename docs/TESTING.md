# Testing & evaluation results

All numbers below come from runs in the build environment (Linux, 4 CPUs, 15 GB RAM, no GPU,
PostgreSQL 16, Node 22). Nothing is estimated.

## Automated tests (last run: all passing)

| Suite | Command | Result | What it covers |
|---|---|---|---|
| Core unit | `npm test -w @exammate/core` | **140 / 140 passed** | Equation solving incl. exact surds, extraneous roots, systems, calculus, statistics, units, physics chaining and word problems, chemistry (118 elements, formula parsing, balancing incl. ionic), SRS, grading, weakness detection, sync merges, i18n key/placeholder parity, classifier regression gate, question splitting, OCR clean-up, local solver routing and modes. **All 15 games:** valid questions for every level × 3 locales × 15 seeds, determinism, perfect play unlocks levels, wrong answers and lives, equation answers re-verified by the solver, sprint deadlines, scoring, memory playthrough, persistence. |
| Server integration | `npm test -w @exammate/server` | **60 / 60 passed** | Real PostgreSQL. Auth (hashing, sessions, verification, reset, CSRF, revocation); cross-user authorization on 19 endpoints; anonymous and admin access; solving + traces; assessment mode; atomic quotas under concurrency; feedback consent; pagination; **real OCR** of a rendered worksheet → solved and balanced; PDF ingestion (background job) → RAG answers with page citations; extraction; flashcard decks; upload validation, limits and audit; failed-job handling; prompt-injection in documents; exams (hidden answers, autosave, grading, manual review, deadline, quota, templates); SM-2 and offline replay; weakness + plan overrides; game-progress merge; content-pack integrity; test-mode billing; memory controls; export and cascading deletion; agent loop (schema validation, bounded retries, timeouts, cancellation, step budget, citation validation); **real llama.cpp runtime**; SHA-256 refusal; llama-server protocol; classifier retrain + rollback; evaluation endpoint. |
| Web unit | `npm test -w @exammate/web` | **3 / 3 passed** | Solution view (verified vs. unsupported), storage fallback. |
| End-to-end | `npm run e2e` | **6 / 6 passed** | Chromium against the real API and DB: register → onboard → solve (verified, KaTeX); Arabic RTL; document upload → cited answer; solver offline; Math Rush played offline → level unlocked → persisted; axe-core WCAG 2 A/AA with no serious or critical violations on 6 page × theme combinations. |
| Mobile | `cd apps/mobile && npx jest` | **3 / 3 passed** | Offline on-device solving; a True-or-False round; local progress persistence. |
| Builds | `npm run build`, `expo export` | **pass** | Core, server, web (PWA; 53 precached entries, ~1.7 MB). Android and iOS Hermes bundles (3.9 MB each). |

The GitHub Actions workflow (`.github/workflows/ci.yml`) mirrors these commands but has **not**
been executed on GitHub from this environment.

## Agent evaluation (`npm run eval`, dataset `agent-eval-2026.10.1`)

| Suite | n | Accuracy | Errors | Unsupported | p50 latency | p95 latency |
|---|---|---|---|---|---|---|
| math | 25 | 96.0 % | 0 % | 4.0 % | ~10 ms | ~34 ms |
| science | 16 | 93.8 % | 0 % | 6.3 % | ~3 ms | ~28 ms |
| multilingual (fr/ar) | 12 | 100 % | 0 % | 0 % | ~5 ms | ~11 ms |
| verification (check-my-answer) | 12 | 100 % | 0 % | 0 % | ~5 ms | ~29 ms |
| grounding (document Q&A, incl. 2 "not in the document" cases) | 8 | 100 % | 0 % | 0 % | <1 ms | ~2 ms |
| subject classifier (held-out) | 30 | 80.0 % | – | – | – | – |

- **Failures:** `m25` (rectangle perimeter word problem) and `s16` (specific heat with the
  constant given inline) both return *unsupported*. There are **no confidently wrong answers**
  in the benchmark.
- **Cost:** the evaluation uses no external services. Its cost is local CPU time, and the
  whole run takes under a second.
- **Scope:** these datasets are small and hand-written. They are regression gates, not broad
  accuracy claims.
