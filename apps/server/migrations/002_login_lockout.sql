-- Per-identity failed-login tracking. Keyed by a hash of the normalised email so that unknown
-- emails are throttled exactly like real accounts (no account enumeration).
CREATE TABLE login_attempts (
  email_hash text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
