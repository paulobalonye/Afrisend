-- Fraud Detection Engine: fraud_assessments, device_fingerprints tables
-- Migration 012: velocity checks, device fingerprinting, behavioral scoring, audit log

-- ─── Fraud Assessments (Audit Log) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fraud_assessments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  TEXT        NOT NULL UNIQUE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  risk_score      SMALLINT    NOT NULL DEFAULT 0
                    CHECK (risk_score BETWEEN 0 AND 100),
  risk_level      TEXT        NOT NULL
                    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  action          TEXT        NOT NULL
                    CHECK (action IN ('approve', 'flag', 'block', 'review')),
  reason_codes    TEXT[]      NOT NULL DEFAULT '{}',
  checks          JSONB       NOT NULL DEFAULT '[]',
  device_id       TEXT        NOT NULL,
  ip_address      INET        NOT NULL,
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fraud_assessments_tx_idx
  ON fraud_assessments (transaction_id);

CREATE INDEX IF NOT EXISTS fraud_assessments_user_idx
  ON fraud_assessments (user_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS fraud_assessments_action_idx
  ON fraud_assessments (action, decided_at DESC);

CREATE INDEX IF NOT EXISTS fraud_assessments_risk_idx
  ON fraud_assessments (risk_score DESC, decided_at DESC);

-- ─── Device Fingerprints ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         TEXT        NOT NULL UNIQUE,
  trust_score       SMALLINT    NOT NULL DEFAULT 10
                      CHECK (trust_score BETWEEN 0 AND 100),
  transaction_count INTEGER     NOT NULL DEFAULT 0,
  known_user_ids    UUID[]      NOT NULL DEFAULT '{}',
  first_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_fingerprints_device_id_idx
  ON device_fingerprints (device_id);

CREATE INDEX IF NOT EXISTS device_fingerprints_trust_idx
  ON device_fingerprints (trust_score ASC);

-- ─── Velocity Counters ────────────────────────────────────────────────────────
-- Stores aggregated velocity signals for fraud analysis reporting.
-- In production, use Redis for real-time velocity tracking.

CREATE TABLE IF NOT EXISTS velocity_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_type     TEXT        NOT NULL
                    CHECK (bucket_type IN ('user', 'ip', 'corridor', 'device')),
  bucket_key      TEXT        NOT NULL,
  transaction_id  TEXT        NOT NULL,
  user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS velocity_events_bucket_idx
  ON velocity_events (bucket_type, bucket_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS velocity_events_user_idx
  ON velocity_events (user_id, occurred_at DESC);
