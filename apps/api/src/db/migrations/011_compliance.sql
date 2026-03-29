-- Compliance Service: compliance_checks and sanctions_hits tables
-- Migration 011: AML screening, sanctions checks, transaction limit audit trail

-- ─── Compliance Checks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_checks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  TEXT        NOT NULL,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  check_type      TEXT        NOT NULL
                    CHECK (check_type IN ('aml', 'sanctions', 'limit')),
  result          TEXT        NOT NULL
                    CHECK (result IN ('approved', 'blocked', 'flagged')),
  risk_score      SMALLINT    NOT NULL DEFAULT 0
                    CHECK (risk_score BETWEEN 0 AND 100),
  error_code      TEXT,
  metadata        JSONB,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_checks_tx_idx
  ON compliance_checks (transaction_id);

CREATE INDEX IF NOT EXISTS compliance_checks_user_idx
  ON compliance_checks (user_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS compliance_checks_result_idx
  ON compliance_checks (result, checked_at DESC);

-- ─── Sanctions Hits ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sanctions_hits (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id        UUID        NOT NULL REFERENCES compliance_checks(id) ON DELETE CASCADE,
  list_name       TEXT        NOT NULL DEFAULT 'OFAC_SDN',
  matched_entry   TEXT        NOT NULL,
  matched_field   TEXT        NOT NULL
                    CHECK (matched_field IN ('sender_name', 'recipient_name')),
  resolution      TEXT        NOT NULL DEFAULT 'blocked'
                    CHECK (resolution IN ('blocked', 'cleared', 'pending_review')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sanctions_hits_check_idx
  ON sanctions_hits (check_id);

-- ─── Transaction Flags ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transaction_flags (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  TEXT        NOT NULL,
  flagged_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  reason          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review', 'cleared', 'confirmed_suspicious')),
  flagged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS transaction_flags_tx_idx
  ON transaction_flags (transaction_id);

CREATE INDEX IF NOT EXISTS transaction_flags_status_idx
  ON transaction_flags (status, flagged_at DESC);
