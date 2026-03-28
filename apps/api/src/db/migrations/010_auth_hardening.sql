-- Auth hardening migration
-- Adds MFA secrets table, login_attempts table, and hardens refresh_tokens.
-- Implements HIT-67: RS256 + refresh token rotation + MFA foundation + rate limiting.

-- ─── Extend refresh_tokens with device fingerprint ───────────────────────────

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS token_family       UUID DEFAULT gen_random_uuid();

-- ─── MFA secrets ─────────────────────────────────────────────────────────────
-- Stores the TOTP secret per user (encrypted at rest in production via pgcrypto).

CREATE TABLE IF NOT EXISTS mfa_secrets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret      TEXT NOT NULL,           -- base32 TOTP secret (encrypt in prod)
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mfa_secrets_user_unique UNIQUE (user_id)
);

-- ─── Login attempts (rate limiting) ──────────────────────────────────────────
-- Tracks failed login attempts per account identifier and per IP.
-- Rows are automatically expired via cleanup job or TTL-aware queries.

CREATE TABLE IF NOT EXISTS login_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL,           -- 'account:<email>' or 'ip:<ip>'
  attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ             -- set after 5th failure
);

CREATE INDEX IF NOT EXISTS login_attempts_key_idx ON login_attempts (key, attempt_at DESC);

-- Function to count recent failures and check lockout
CREATE OR REPLACE FUNCTION get_login_lockout(p_key TEXT)
RETURNS TABLE (attempt_count BIGINT, locked_until TIMESTAMPTZ) AS $$
  SELECT
    COUNT(*) FILTER (WHERE attempt_at > NOW() - INTERVAL '15 minutes') AS attempt_count,
    MAX(locked_until) FILTER (WHERE locked_until > NOW()) AS locked_until
  FROM login_attempts
  WHERE key = p_key;
$$ LANGUAGE SQL STABLE;
