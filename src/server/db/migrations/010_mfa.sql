-- Migration 010: TOTP MFA support
-- Adds MFA columns to users table and backup codes table

-- ── MFA columns on users ─────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret        TEXT,           -- encrypted TOTP secret (base32)
  ADD COLUMN IF NOT EXISTS mfa_confirmed_at  TIMESTAMPTZ;    -- NULL until user confirms setup

-- ── MFA backup codes ─────────────────────────────────────────────────────────
-- Single-use recovery codes for when the user loses their authenticator device.
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,        -- bcrypt hash of the backup code
  used_at     TIMESTAMPTZ,          -- NULL until consumed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mfa_backup_codes_user_idx
  ON mfa_backup_codes (user_id)
  WHERE used_at IS NULL;
