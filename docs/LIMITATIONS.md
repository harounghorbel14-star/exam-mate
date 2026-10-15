# Known limitations and unresolved issues

1. **No real language model was run.** The local runtime is wired up and verified with a
   random-weight fixture model. Quality, latency and memory use with real weights are unknown
   until a model is installed (see LOCAL_MODELS.md). Without a model, open-ended knowledge
   questions are answered only from the user's own documents.
2. **Solver coverage.** The deterministic solver covers calculation-style questions, including
   common geometry and physics word problems. Phrasings outside its patterns return
   "unsupported" rather than a wrong answer. For example: "find the other leg" in a right
   triangle, and multi-shape composite figures.
3. **Subject classifier:** 96.7 % on a small 30-question held-out set. This is optimistic: the
   training additions were written knowing the earlier confusions (see TESTING.md). It only
   routes and labels questions; it never produces answers.
4. **OCR:** printed text works well. Handwriting, complex layouts and diagrams are not
   reliable, and math notation (fractions, exponents) is often flattened. Users can edit the
   text before solving.
5. **Document intelligence is extractive.** Summaries, quizzes and flashcards come from sentence
   scoring and pattern rules. Scanned (image-only) PDFs produce no text; they must be scanned
   page by page.
6. **Mobile:**
   - not tested on a physical device or emulator (only Jest and Metro bundles);
   - no on-device OCR (uses the server);
   - no voice input;
   - switching to or from Arabic needs an app restart;
   - mobile exams lack manual review, templates and strategy mode, and mobile tools lack the
     graph plotter, notes and timer (all on web).
7. **Billing is test mode only.** Integrating a real provider (e.g. Stripe Checkout + signed
   webhooks) is required before charging anyone. Test checkout sessions live in process memory.
8. **Email delivery:** messages go to the `outbox_emails` table; no SMTP transport is
   configured.
9. **Scale:** rate limits can be shared through PostgreSQL (`RATE_LIMIT_STORE=postgres`), but
   test-checkout state is still in-memory per process; object storage
   is local disk. Use shared stores and S3-compatible storage for multiple instances.
10. **Translations** were written for this build and have not been reviewed by native speakers.
    Bundled game content is moderate in size (e.g. 24 general-knowledge and 20 biology
    questions, 54 countries); more can be added as downloadable packs.
11. **Not done:** geometry diagram rendering, WebAuthn/passkeys (two-factor is TOTP only; it is turned on from
    the web app, and mobile supports the sign-in step), upload malware scanning, CAPTCHA, LoRA
    fine-tuning tooling.
12. **Arcade:**
    - played and tested in Chromium and in Jest/React Native Testing Library only; **never on a
      physical phone, tablet or emulator** — touch feel, frame rate of the real-time games (Snake,
      Falling Blocks, Pong) and audio output on devices are unverified;
    - mobile game boards are drawn with plain views (no canvas/GPU layer); very old devices may
      drop frames in Pong;
    - AIs are deliberately simple (Checkers searches 5 plies on Hard; Connect Four 6);
    - Hangman word lists are small (25 words per language and difficulty) and were not reviewed
      by native speakers;
    - game boards stay left-to-right in Arabic (the rules and text are mirrored).
13. **Online multiplayer:**
    - verified with two and three independent browser clients against a local server, and with
      many WebSocket clients in server tests; **not** verified between physical phones, over
      mobile networks or across the public internet;
    - rooms are owned by **one API process** (in memory, written through to PostgreSQL). Running
      several API instances requires routing all of a room's sockets to the same instance or a
      shared pub/sub layer, which is not implemented; deploy a single instance for now;
    - reaction-race times include each player's network latency (the server measures when the
      tap arrives), so it is only fair on similar connections;
    - private rooms only: no public matchmaking, spectators, chat or friend lists;
    - mobile invites carry the room code and an `exammate://play/<code>` link that opens the app
      straight into the room (tested in Jest only); there are no https universal/app links, which
      need a verified domain;
    - trivia uses the bundled 24-question general-knowledge bank;
    - a ticket must be fetched over HTTPS before each connection, so online play needs an
      account; offline/pass-and-play modes stay in the Arcade.
14. **`npm audit`** reports advisories in transitive (mostly development) dependencies that have
    not been triaged individually.
