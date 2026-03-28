-- Migration 002: bank_accounts table
-- Stores verified bank account details for recipients and senders.

CREATE TABLE IF NOT EXISTS bank_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_code      TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name   TEXT NOT NULL,
  verified       BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate accounts for the same user
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_unique_account
  ON bank_accounts (user_id, bank_code, account_number);

CREATE INDEX IF NOT EXISTS bank_accounts_user_idx
  ON bank_accounts (user_id, created_at DESC);

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
