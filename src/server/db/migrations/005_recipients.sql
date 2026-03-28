-- Migration 005: recipients table + user profile extended fields
-- Adds saved payment recipients and additional user profile fields.

-- ─── User profile extensions ─────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name          TEXT,
  ADD COLUMN IF NOT EXISTS preferred_currency    TEXT,
  ADD COLUMN IF NOT EXISTS notification_email    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notification_sms      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notification_push     BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── Recipients table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  country         TEXT NOT NULL,
  payout_method   TEXT NOT NULL CHECK (payout_method IN ('mobile_money', 'bank_transfer')),
  -- Encrypted JSON blob: { type, phoneNumber, provider } or { type, accountNumber, bankCode, bankName }
  account_details TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recipients_user_idx ON recipients (user_id, created_at DESC);

CREATE TRIGGER recipients_updated_at
  BEFORE UPDATE ON recipients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
