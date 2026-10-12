# Known limitations and unresolved issues

1. **No real language model was run.** The local runtime is wired up and verified with a
   random-weight fixture model. Quality, latency and memory use with real weights are unknown
   until a model is installed (see LOCAL_MODELS.md). Without a model, open-ended knowledge
   questions are answered only from the user's own documents.
2. **Solver coverage.** The deterministic solver covers calculation-style questions. Benchmark
   gaps are listed in `docs/TESTING.md`, for example a geometry word problem and a
   specific-heat problem with the constant given inline. Both return "unsupported" rather than
   a wrong answer.
3. **Subject classifier accuracy is 80%** on a 30-question held-out set (Naive Bayes on a small
   hand-written dataset). It only routes and labels questions; it never produces answers.
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
   - exams, coach and tools are web-only.
7. **Billing is test mode only.** Integrating a real provider (e.g. Stripe Checkout + signed
   webhooks) is required before charging anyone. Test checkout sessions live in process memory.
8. **Email delivery:** messages go to the `outbox_emails` table; no SMTP transport is
   configured.
9. **Scale:** the rate limiter and test-checkout state are in-memory per process; object storage
   is local disk. Use shared stores and S3-compatible storage for multiple instances.
10. **Translations** were written for this build and have not been reviewed by native speakers.
    Bundled game content is moderate in size (e.g. 24 general-knowledge and 20 biology
    questions, 54 countries); more can be added as downloadable packs.
11. **Not done:** geometry diagram rendering, MFA, upload malware scanning, LoRA fine-tuning
    tooling.
12. **`npm audit`** reports advisories in transitive (mostly development) dependencies that have
    not been triaged individually.
