-- Migration 005: Align schemas with architecture spec §3.2 / §3.3
--
-- Changes:
--   1. Add `version` (optimistic locking) to users, transactions, kyc_sessions
--   2. Add `deleted_at` (soft delete) to users, transactions, bank_accounts
--   3. Migrate money amount fields on transactions from NUMERIC → BIGINT
--   4. Add `compliance_status` and `risk_score` to transactions
--   5. Create `recipients` table with encrypted account details
--   6. Add partial indexes idx_txn_status and idx_txn_compliance

-- ─── 1. Optimistic locking: version column ────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE kyc_sessions
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- ─── 2. Soft delete: deleted_at column ───────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── 3. Money fields → BIGINT (smallest currency unit) ───────────────────────
--
-- source_amount, destination_amount, and fee are absolute money values
-- stored as integer cents/kobo/pesewas to avoid floating-point rounding.
-- exchange_rate stays NUMERIC because it is a ratio, not a money amount.

ALTER TABLE transactions
  ALTER COLUMN source_amount      TYPE BIGINT USING ROUND(source_amount)::BIGINT,
  ALTER COLUMN destination_amount TYPE BIGINT USING ROUND(destination_amount)::BIGINT,
  ALTER COLUMN fee                TYPE BIGINT USING ROUND(fee)::BIGINT;

-- ─── 4. Compliance columns on transactions ────────────────────────────────────

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS compliance_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS risk_score        SMALLINT;

-- ─── 5. Recipients table ─────────────────────────────────────────────────────
--
-- Stores saved recipients per user.  account_details_encrypted holds
-- AES-256-GCM ciphertext of the JSON account payload (bank code, account
-- number, mobile wallet number, etc.) — encryption is handled at the
-- application layer before persistence.

CREATE TABLE IF NOT EXISTS recipients (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname                  TEXT,
  country                   TEXT        NOT NULL,
  payout_method             TEXT        NOT NULL
                              CHECK (payout_method IN ('mobile_money', 'bank_transfer')),
  account_details_encrypted TEXT        NOT NULL,  -- AES-256-GCM ciphertext (app-layer)
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recipients_user_idx
  ON recipients (user_id, created_at DESC);

CREATE TRIGGER recipients_updated_at
  BEFORE UPDATE ON recipients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 6. Partial indexes on transactions ──────────────────────────────────────
--
-- idx_txn_status: covers in-flight transactions (pending, processing, etc.)
-- so compliance and status-polling queries skip the large completed/cancelled set.

CREATE INDEX IF NOT EXISTS idx_txn_status
  ON transactions (status, created_at DESC)
  WHERE status NOT IN ('completed', 'cancelled');

-- idx_txn_compliance: covers only flagged transactions for compliance queue.

CREATE INDEX IF NOT EXISTS idx_txn_compliance
  ON transactions (compliance_status, created_at DESC)
  WHERE compliance_status = 'flagged';
