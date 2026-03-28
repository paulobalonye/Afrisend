-- Transaction Service: transactions and transaction_events tables
-- Migration 006: Core send-money flow data model

-- ─── Transactions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recipient_id        UUID        REFERENCES recipients(id) ON DELETE SET NULL,
  idempotency_key     TEXT        NOT NULL,
  amount              NUMERIC(18,6) NOT NULL CHECK (amount > 0),
  currency            TEXT        NOT NULL,
  target_amount       NUMERIC(18,6) NOT NULL CHECK (target_amount > 0),
  target_currency     TEXT        NOT NULL,
  fx_rate             NUMERIC(18,6) NOT NULL CHECK (fx_rate > 0),
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled')),
  payout_rail         TEXT,
  payout_reference    TEXT,
  retry_count         SMALLINT    NOT NULL DEFAULT 0,
  failure_reason      TEXT,
  quote_id            TEXT,
  corridor_id         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_idempotency_key_user_idx
  ON transactions (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx
  ON transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_status_idx
  ON transactions (status);

-- ─── Transaction Events (state transition log) ─────────────────────────────

CREATE TABLE IF NOT EXISTS transaction_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  from_status     TEXT,
  to_status       TEXT        NOT NULL,
  actor           TEXT        NOT NULL DEFAULT 'system',
  note            TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transaction_events_tx_idx
  ON transaction_events (transaction_id, created_at ASC);
