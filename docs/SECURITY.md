# Security checklist

This lists controls that are **implemented and tested**, and items that are **not yet done**.
It is not a compliance certification; no external audit has been performed.

## Implemented
- [x] **Passwords:** scrypt (N=2^15, r=8, p=1, 16-byte salt), timing-safe comparison, a dummy
  hash for unknown emails (no timing-based enumeration), minimum length and common-password
  rejection.
- [x] **Sessions:** 256-bit random tokens; only SHA-256 hashes are stored; expiry; per-device
  revocation; all sessions revoked on password reset.
- [x] **Cookies:** httpOnly, SameSite=Lax, `Secure` required in production (startup check).
- [x] **CSRF:** a custom header is required for cookie-authenticated mutations, and the CORS
  allowlist blocks cross-origin preflights.
- [x] **Email verification and password reset:** single-use, expiring, hashed tokens. The reset
  response never reveals whether an account exists.
- [x] **Authorization:** every resource query filters by `user_id`, and other users' resources
  return 404. Tested for documents, questions, solutions, decks, cards, attempts, notes and
  memory. Admin routes check the role.
- [x] **Account lockout:** after 5 consecutive failures, keyed by a hash of the email, so unknown
  emails behave identically (no enumeration). The lock starts at 15 minutes and doubles with
  each further failure (24 h cap). A successful login or a password reset clears it, and
  `Retry-After` is returned.
- [x] **Rate limiting:** global (300/min/IP), auth (20 per 15 min), solve/scan (30/min/user).
  Daily plan quotas are enforced atomically with advisory locks (a concurrency test checks
  this).
- [x] **Input validation:** zod on every body and query, UUID path parameters, JSON limit of 1 MB.
- [x] **Uploads:** type detected by content (magic bytes), not by extension or MIME. Allow-list
  of PDF/DOCX/TXT/MD and PNG/JPEG/WebP; NUL/UTF-8 checks for text; size limits per plan; page
  and character limits; sanitized filenames; random storage keys validated against path
  traversal; files stored outside the web root with mode 0600; rejected uploads are audited.
- [x] **Untrusted content / prompt injection:** document, OCR and question text is treated as
  data:
  - injection patterns are detected (en/fr/ar),
  - role markers and bidi control characters are stripped,
  - text is fenced in delimited blocks,
  - tool permissions come from the caller context, never from model output,
  - model JSON is schema-validated,
  - model citations must match retrieved chunks.
- [x] **Resource limits:** agent step budget, wall-clock timeout, client-disconnect
  cancellation, bounded retries, serialized OCR with a timeout, LLM token caps and timeouts.
- [x] **Local model integrity:** GGUF magic check plus SHA-256 verification before loading;
  the llama-server URL is restricted to loopback.
- [x] **Expression sandbox:** user math never reaches `eval`. mathjs parse trees are rejected
  if they contain assignments, property access or dangerous functions (`import`, `evaluate`,
  …).
- [x] **HTTP headers:** helmet with a strict CSP (no inline scripts, `frame-ancestors 'none'`),
  `X-Powered-By` disabled, `Cache-Control: no-store` on the API.
- [x] **Secrets:** none in the repository. Configuration comes from the environment
  (`.env.example` has placeholders only), and the server refuses the development DB password
  in production.
- [x] **Audit log:** registration, logins, failed logins (email hashed), password resets, email
  verification, document upload/delete, rejected uploads, exports, account deletion, billing
  events, memory clearing, model activation/rollback.
- [x] **Privacy:**
  - full JSON export and password-confirmed account deletion (cascading delete plus file
    removal);
  - agent traces store only an input hash and expire after 30 days;
  - feedback text is kept only with explicit training consent;
  - inferred memory skips sensitive-looking data and expires after 180 days.
- [x] **Mobile:** the token is kept in Keychain/Keystore (expo-secure-store); the camera is
  requested only on tap; the Android microphone permission is explicitly blocked.
- [x] **Voice (web):** speech recognition runs only while the button is active
  (`continuous: false`); nothing is recorded in the background.
- [x] **Two-factor authentication (TOTP, RFC 6238):** optional per account. Turning it on needs
  the password and a code from an authenticator app. Secrets are encrypted at rest with
  AES-256-GCM (`MFA_ENCRYPTION_KEY`, required in production). Codes are accepted within ±30 s, and
  each time step only once (replay protection). After a correct password, login returns a 5-minute
  challenge with at most 5 attempts; no session exists until the second factor succeeds. There are
  10 single-use recovery codes, stored hashed, which can be regenerated. Turning it off needs the
  password plus a code. Every step is audited.
- [x] **Shared rate limits:** with `RATE_LIMIT_STORE=postgres` (the default in production), the
  global, auth and solve limiters count in PostgreSQL with one atomic upsert per request, so limits
  hold across all API instances.
- [x] **Multiplayer:** sockets authenticate with single-use, 60-second, hashed tickets issued by
  the authenticated API (no long-lived token in URLs); browser Origins are checked; messages are
  size-limited, strictly validated (unknown fields such as a client "score" are rejected) and rate
  limited; the server validates every move, owns all timers and randomness (CSPRNG seeds) and
  computes all scores; each player receives only their view (opponent RPS choices, face-down
  cards, trivia answers and reaction go-times are withheld); stale steps and replayed action ids
  are rejected and processing per connection is sequential; rooms can only be entered with their
  code, are capped at 2–4 players and stop admitting players once a game starts.
- [x] **Billing:** test mode only, with explicit confirmation; nothing can be charged.

## Not yet done / recommended before production
- [ ] External penetration test and dependency audit triage (`npm audit` reports advisories in
  dev and transitive dependencies that have not been reviewed one by one).
- [ ] Real SMTP transport with SPF/DKIM; email verification is not yet *required* for any
  feature.
- [ ] Malware scanning of uploads (e.g. ClamAV) before processing.
- [ ] Encryption at rest for object storage and database (an infrastructure setting).
- [ ] CAPTCHA after repeated failures.
- [ ] A real payment provider with signed webhooks.
- [ ] Multiplayer across several API instances (needs sticky routing or pub/sub; single instance today).
- [ ] Test-mode checkout sessions are kept in memory; they are lost on restart and not shared
  between instances.
