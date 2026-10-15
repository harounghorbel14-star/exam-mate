-- Two-factor authentication (TOTP, RFC 6238) and a shared rate-limit store.
ALTER TABLE users
  ADD COLUMN mfa_secret_enc text,          -- AES-256-GCM encrypted base32 secret (active)
  ADD COLUMN mfa_pending_enc text,         -- secret awaiting confirmation during setup
  ADD COLUMN mfa_enabled_at timestamptz,
  ADD COLUMN mfa_last_step bigint;         -- last accepted 30 s time step (replay protection)

CREATE TABLE mfa_recovery_codes (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz
);
CREATE INDEX mfa_recovery_codes_user_idx ON mfa_recovery_codes (user_id);

-- Second login step: issued after a correct password, exchanged for a session with a valid code.
CREATE TABLE mfa_challenges (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0
);

-- Fixed-window counters shared by every API instance (RATE_LIMIT_STORE=postgres).
CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_reset_idx ON rate_limits (reset_at);
