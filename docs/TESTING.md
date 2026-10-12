# Testing & evaluation results

All numbers below come from runs in the build environment (Linux, 4 CPUs, 15 GB RAM, no GPU,
PostgreSQL 16, Node 22). Nothing is estimated.

## Automated tests (last full local run: all passing)

| Suite | Command | Result | What it covers |
|---|---|---|---|
| Core unit | `npm test -w @exammate/core` | **211 / 211 passed** | Equation solving incl. exact surds, extraneous roots, systems, calculus, statistics, units, physics chaining and word problems, chemistry (118 elements, formula parsing, balancing incl. ionic), SRS, grading, weakness detection, sync merges, i18n key/placeholder parity, classifier regression gate, question splitting, OCR clean-up, local solver routing and modes, geometry word problems (en/fr/ar, mixed units), inline physics givens, constants (π, e) in equations. **All 15 educational games:** valid questions for every level × 3 locales × 15 seeds, determinism, perfect play unlocks levels, wrong answers and lives, equation answers re-verified by the solver, sprint deadlines, scoring, memory playthrough, persistence. **Arcade (53 tests):** catalogue (15 distinct ids, 30 games in total, trilingual text parity, cross-language search); Tic-Tac-Toe exhaustive check that the hard AI never loses against every human line; Connect Four lines in all directions, full columns, AI win/block; RPS scoring and adaptive AI; Snake growth, reversal, wall/self collision, wrap; Falling Blocks gravity, walls, rotation, double-line clear scoring, hold, top-out, start levels; 2048 merges, spawns, no-op moves, win/game over; Pong bounces, scoring, winner, paddle bounds; Minesweeper safe first click over 50 seeds, neighbour counts, flags, win/loss; Sudoku validity and **uniqueness** of generated puzzles, mistakes, hints, win/loss; Hangman word lists typeable with each locale's keyboard, accent and hamza folding, multi-word answers; Maze perfect-maze property over 30 seeds, BFS solvability, timing, time limit; Reaction timing, false starts, anticipation; Simon growth, speed-up, retries; Memory grids, moves, two-player turns; Checkers opening moves, mandatory multi-jumps, promotion, king moves, wins, AI capture; stats (streaks, best score/time, validation of bad values), device merge, repository persistence across reloads and corrupt-data recovery. **Multiplayer rules (11 tests):** turn and step validation, stale replays, timeouts and forfeits, checkers legality, RPS/memory/trivia/reaction redaction, server-side trivia scoring with speed bonus, reaction false starts, restart clock shifting, protocol validation (tampered fields, oversized and malformed input), room codes. |
| Server integration | `npm test -w @exammate/server` | **78 / 78 passed** | Real PostgreSQL. Auth (hashing, sessions, verification, reset, CSRF, revocation, per-identity lockout with reset unlock); cross-user authorization on 19 endpoints; anonymous and admin access; solving + traces; assessment mode; atomic quotas under concurrency; feedback consent; pagination; **real OCR** of a rendered worksheet → solved and balanced; PDF ingestion (background job) → RAG answers with page citations; extraction; flashcard decks; upload validation, limits and audit; failed-job handling; prompt-injection in documents; exams; SM-2 and offline replay; weakness + plan overrides; game-progress merge; **arcade stats sync** (device merge, idempotent replay, unknown games and negative values rejected); content-pack integrity; test-mode billing; memory controls; export and cascading deletion; agent loop; **real llama.cpp runtime**; SHA-256 refusal; llama-server protocol; classifier retrain + rollback; evaluation endpoint. **Multiplayer over real WebSockets (15 tests, several sockets per test):** single-use tickets, ticket replay, auth timeout, foreign Origin refused; room codes, joining, capacity, unknown codes, invite preview; host-only controls, ready check, kick, host migration; a full Tic-Tac-Toe game between two sockets with out-of-turn, stale-step, duplicate-action-id, tampered-payload and concurrent-move rejection, result persisted, rematch; RPS hidden choices; three-player trivia timed and scored by the server; reaction race (server go time, false-start penalty); memory challenge redaction; reconnect to the same seat; automatic reconnect of the shared core client; grace-period forfeit; turn-timer forfeit; abandoned-room sweep; **server restart** with rooms restored from PostgreSQL and the game continued; flood rate limiting. |
| Web unit | `npm test -w @exammate/web` | **10 / 10 passed** | Solution view, storage fallback, Arcade hub search, play shell rules/start/pause/resume, Tic-Tac-Toe win and paused input, Connect Four win and AI reply, Hangman keyboard input and RTL keyboard. |
| End-to-end | `npm run e2e` | **27 / 27 passed** | Chromium against the real API and DB. Original 6: register → solve, Arabic RTL, document Q&A with citation, offline solver, Math Rush offline with level unlock, axe on 6 pages. **Arcade (19):** each of the 15 games is played in the browser — e.g. Sudoku solved to a win, Minesweeper first click safe, Maze escaped by a wall-follower, Memory Match fully matched, Simon sequences repeated, Hard Tic-Tac-Toe AI never beaten, 2048 board restored after leaving; hub search/categories/favourites persisted; offline play via the service worker with stats recorded; Arabic RTL; axe on the hub and a game (light and dark). **Multiplayer (2):** two independent browser contexts register, create/join via invite link, ready up and play Tic-Tac-Toe to a win in real time, including a mid-game page reload that reconnects to the same seat, then rematch; three independent contexts complete a 7-question trivia party. |
| Mobile | `cd apps/mobile && npx jest` | **25 / 25 passed** | Original 6 plus: Arcade hub search/favourites; Tic-Tac-Toe pass-and-play through the play shell with stats written to AsyncStorage; per-game interaction tests for all 15 components (Connect Four win, Checkers move, RPS hidden choice, Memory, Minesweeper, Sudoku solved to a win, Hangman, Snake wall, Blocks drop, Maze, Reaction false start, Simon, Pong, 2048); online-play screen against a scripted socket (ticket auth, create room, move with the current step), the `exammate://play/<code>` invite link routing to the room and auto-joining it, and the signed-out/offline message. |
| Builds | `npm run build`, `build:demo`, `expo export` | **pass** | Core, server, web (PWA; 74 precached entries, ~1.9 MB, every arcade game chunk included), static demo. Android and iOS Hermes bundles (~4.1 MB each), including the 13 generated sound files. |

Flaky-test notes: the Reaction Test e2e initially failed 2 of 3 repeats because Playwright tapped
within 100 ms of the signal, which the game correctly scores as anticipation. The test now waits a
human-plausible 150 ms; it then passed 5 of 5 repeats. The 2048 e2e failed once because keys were pressed before
the saved board finished loading from local storage; it now waits for the board (8 of 8 repeats
passed). After both fixes the full e2e suite passed twice in a row (27 / 27 each).

**CI on GitHub:** see the PR for the latest run. Earlier runs of this branch failed on two real
issues that are now fixed: llama.cpp token counting (the `onToken` callback over-counted tokens
that are held back for incomplete UTF-8; reproduced locally in 12 of 60 generations, 0 of 60 after
the fix) and a mobile Jest test exceeding the 5 s default timeout on a cold runner.

**Not tested:** any game or online session on a physical phone, tablet or emulator; sound output
on real devices; multiplayer across the public internet or with more than one API instance.

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
