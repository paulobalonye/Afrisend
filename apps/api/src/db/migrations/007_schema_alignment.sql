-- Migration 007: Align schemas with architecture spec §3.2 / §3.3
--
-- Prereq: 005_recipients.sql already created the recipients table with
--         account_details TEXT and a basic schema.
--
-- Changes:
--   1. Add `version` (optimistic locking) to users, transactions, kyc_sessions
--   2. Add `deleted_at` (soft delete) to users, transactions, bank_accounts
--   3. Migrate money amount fields on transactions from NUMERIC → BIGINT
--   4. Add `compliance_status` and `risk_score` to transactions
--   5. Extend recipients: add `nickname`, rename account_details →
--      account_details_encrypted to reflect app-layer encryption contract
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

-- ─── 5. Extend recipients table ──────────────────────────────────────────────
--
-- 005_recipients.sql created recipients with a plain `account_details TEXT`
-- column.  The architecture spec (§3.3) requires:
--   - `nickname TEXT` (optional display name for saved recipients)
--   - `account_details_encrypted TEXT` (AES-256-GCM ciphertext, app-layer)
--
-- We rename the column to make the encryption contract explicit in the
-- schema, and add nickname.

ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Rename account_details → account_details_encrypted only when the old
-- column still exists (idempotency guard via DO block).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'recipients'
      AND column_name  = 'account_details'
  ) THEN
    ALTER TABLE recipients RENAME COLUMN account_details TO account_details_encrypted;
  END IF;
END;
$$;

-- ─── 6. Partial indexes on transactions ──────────────────────────────────────
--
-- idx_txn_status: covers in-flight transactions (pending, processing, etc.)
-- so compliance and status-polling queries skip the large completed/cancelled set.

CREATE INDEX IF NOT EXISTS idx_txn_status
  ON transactions (status, created_at DESC)
  WHERE status NOT IN ('completed', 'cancelled');

-- idx_txn_compliance: covers only flagged transactions for the compliance queue.

CREATE INDEX IF NOT EXISTS idx_txn_compliance
  ON transactions (compliance_status, created_at DESC)
  WHERE compliance_status = 'flagged';
