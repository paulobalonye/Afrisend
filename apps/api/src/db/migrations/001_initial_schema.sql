-- AfriSend initial database schema
-- Run order: this file is loaded by PostgreSQL on first container start via docker-entrypoint-initdb.d

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             TEXT,
  email             TEXT,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  password_hash     TEXT,
  kyc_tier          SMALLINT NOT NULL DEFAULT 0,
  kyc_status        TEXT NOT NULL DEFAULT 'none'
                      CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected', 'more_info_needed')),
  date_of_birth     DATE,
  nationality       TEXT,
  residence_country TEXT,
  purpose           TEXT
                      CHECK (purpose IN ('family', 'business', 'savings', 'education', 'other')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

-- ─── OTP sessions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS otp_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    TEXT NOT NULL,  -- phone or email
  channel       TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  code_hash     TEXT NOT NULL,  -- bcrypt hash of the OTP code
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  attempts      SMALLINT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_sessions_identifier_idx ON otp_sessions (identifier, created_at DESC);

-- ─── Refresh tokens ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ─── KYC records ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL DEFAULT 'veriff',
  provider_ref     TEXT,           -- Veriff session ID
  tier             SMALLINT NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'more_info_needed')),
  rejection_reason TEXT,
  submitted_at     TIMESTAMPTZ,
  decided_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_sessions_user_idx ON kyc_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_session_id UUID NOT NULL REFERENCES kyc_sessions(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL CHECK (document_type IN ('passport', 'national_id', 'driver_license')),
  side           TEXT NOT NULL CHECK (side IN ('front', 'back', 'selfie', 'address')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'accepted', 'rejected')),
  storage_key    TEXT,   -- S3/GCS key, populated in production
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Transactions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key      TEXT NOT NULL UNIQUE,
  provider             TEXT NOT NULL CHECK (provider IN ('yellowcard', 'flutterwave')),
  provider_payment_id  TEXT,
  corridor_id          TEXT NOT NULL,
  source_currency      TEXT NOT NULL,
  destination_currency TEXT NOT NULL,
  source_amount        NUMERIC(18, 8) NOT NULL,
  destination_amount   NUMERIC(18, 8) NOT NULL,
  exchange_rate        NUMERIC(18, 8) NOT NULL,
  fee                  NUMERIC(18, 8) NOT NULL,
  quote_id             TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  recipient_name       TEXT,
  recipient_account    TEXT,
  recipient_bank_code  TEXT,
  recipient_bank_name  TEXT,
  failure_reason       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status);

-- ─── Audit log ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  service     TEXT NOT NULL,
  operation   TEXT NOT NULL,
  request_id  TEXT NOT NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  duration_ms INTEGER NOT NULL,
  error_code  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_service_idx ON audit_log (service, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER kyc_sessions_updated_at
  BEFORE UPDATE ON kyc_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
