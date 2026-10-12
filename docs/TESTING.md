# Testing & evaluation results

All numbers below come from runs in the build environment (Linux, 4 CPUs, 15 GB RAM, no GPU,
PostgreSQL 16, Node 22). Nothing is estimated.

## Automated tests (last run: all passing)

| Suite | Command | Result | What it covers |
|---|---|---|---|
| Core unit | `npm test -w @exammate/core` | **147 / 147 passed** | Equation solving incl. exact surds, extraneous roots, systems, calculus, statistics, units, physics chaining and word problems, chemistry (118 elements, formula parsing, balancing incl. ionic), SRS, grading, weakness detection, sync merges, i18n key/placeholder parity, classifier regression gate, question splitting, OCR clean-up, local solver routing and modes, geometry word problems (en/fr/ar, mixed units), inline physics givens, constants (π, e) in equations. **All 15 games:** valid questions for every level × 3 locales × 15 seeds, determinism, perfect play unlocks levels, wrong answers and lives, equation answers re-verified by the solver, sprint deadlines, scoring, memory playthrough, persistence. |
| Server integration | `npm test -w @exammate/server` | **62 / 62 passed** | Real PostgreSQL. Auth (hashing, sessions, verification, reset, CSRF, revocation, per-identity lockout with reset unlock); cross-user authorization on 19 endpoints; anonymous and admin access; solving + traces; assessment mode; atomic quotas under concurrency; feedback consent; pagination; **real OCR** of a rendered worksheet → solved and balanced; PDF ingestion (background job) → RAG answers with page citations; extraction; flashcard decks; upload validation, limits and audit; failed-job handling; prompt-injection in documents; exams (hidden answers, autosave, grading, manual review, deadline, quota, templates); SM-2 and offline replay; weakness + plan overrides; game-progress merge; content-pack integrity; test-mode billing; memory controls; export and cascading deletion; agent loop (schema validation, bounded retries, timeouts, cancellation, step budget, citation validation); **real llama.cpp runtime**; SHA-256 refusal; llama-server protocol; classifier retrain + rollback; evaluation endpoint. |
| Web unit | `npm test -w @exammate/web` | **3 / 3 passed** | Solution view (verified vs. unsupported), storage fallback. |
| End-to-end | `npm run e2e` | **6 / 6 passed** | Chromium against the real API and DB: register → onboard → solve (verified, KaTeX); Arabic RTL; document upload → cited answer; solver offline; Math Rush played offline → level unlocked → persisted; axe-core WCAG 2 A/AA with no serious or critical violations on 6 page × theme combinations. |
| Mobile | `cd apps/mobile && npx jest` | **6 / 6 passed** | Offline on-device solving; a True-or-False round; local progress persistence; calculator / unit converter / balancer; coach allocation and guessing EV; exam start → answer → graded results (server stubbed). |
| Builds | `npm run build`, `expo export` | **pass** | Core, server, web (PWA; 53 precached entries, ~1.7 MB). Android and iOS Hermes bundles (~4 MB each). |

The GitHub Actions workflow (`.github/workflows/ci.yml`) mirrors these commands but has **not**
been executed on GitHub from this environment.

## Agent evaluation (`npm run eval`, dataset `agent-eval-2026.10.2`)

| Suite | n | Accuracy | Errors | Unsupported | p50 latency | p95 latency |
|---|---|---|---|---|---|---|
| math (incl. 6 geometry word problems) | 30 | 100 % | 0 % | 0 % | ~10 ms | ~36 ms |
| science | 19 | 100 % | 0 % | 0 % | ~4 ms | ~13 ms |
| multilingual (fr/ar) | 12 | 100 % | 0 % | 0 % | ~3 ms | ~8 ms |
| verification (check-my-answer) | 12 | 100 % | 0 % | 0 % | ~6 ms | ~35 ms |
| grounding (document Q&A, incl. 2 "not in the document" cases) | 8 | 100 % | 0 % | 0 % | <1 ms | ~2 ms |
| subject classifier (held-out) | 30 | 96.7 % | – | – | – | – |

History of this benchmark:
- **Dataset 2026.10.1:** math 96 %, science 93.8 %. The two misses (a rectangle word problem
  and specific heat with an inline constant) returned *unsupported*.
- **Dataset 2026.10.2:** 8 new cases were written **before** implementing geometry and
  inline-constant parsing. The baseline on them was 0/8 (all *unsupported*).
- **After the change, all pass.** Separate probe tests with different phrasings exposed further
  gaps, which were fixed:
  - keywords after numbers ("12 m long");
  - French "carré";
  - Arabic possessives;
  - radius vs. diameter ("نصف قطر").

  They also exposed an engine bug: equations containing π or e skipped the exact solver and
  missed roots above 100.
- **Classifier:** 80 % → 96.7 % after adding 74 training sentences (dataset `subjects-2026.10.2`,
  no overlap with the held-out set). **Caveat:** the new examples were written knowing which
  categories were confused, and the evaluation sets are small and authored by the same
  developer. Treat these as regression gates, not independent accuracy estimates. A larger
  third-party test set is needed for real accuracy claims.

The evaluation uses no external services. Its cost is local CPU time (under a second per run).
