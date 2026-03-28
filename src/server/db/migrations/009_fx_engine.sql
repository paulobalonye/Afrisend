-- Migration 009: FX Rate Engine tables
-- Tables: corridor_markup_config, fx_rate_snapshots, fx_quotes

-- ── Corridor markup configuration ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corridor_markup_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10) NOT NULL,
  to_currency   VARCHAR(10) NOT NULL,
  markup_bps    INTEGER     NOT NULL CHECK (markup_bps >= 0),
  min_fee       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  max_fee       NUMERIC(18, 6),
  fee_structure VARCHAR(20) NOT NULL DEFAULT 'flat'
                CHECK (fee_structure IN ('flat', 'percentage', 'tiered')),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_currency, to_currency)
);

-- Seed common African corridors (markup_bps = basis points over mid rate)
INSERT INTO corridor_markup_config (from_currency, to_currency, markup_bps, min_fee, max_fee, fee_structure)
VALUES
  ('USD', 'NGN', 150, 2.00, 15.00, 'flat'),
  ('USD', 'GHS', 150, 2.00, 15.00, 'flat'),
  ('USD', 'KES', 130, 1.50, 12.00, 'flat'),
  ('USD', 'TZS', 140, 1.50, 12.00, 'flat'),
  ('USD', 'UGX', 140, 1.50, 12.00, 'flat'),
  ('USD', 'ZAR', 120, 1.00, 10.00, 'flat'),
  ('USD', 'ETB', 160, 2.00, 15.00, 'flat'),
  ('USD', 'XOF', 140, 1.50, 12.00, 'flat'),
  ('USD', 'XAF', 140, 1.50, 12.00, 'flat'),
  ('USD', 'EGP', 130, 1.50, 12.00, 'flat'),
  ('USD', 'MAD', 120, 1.00, 10.00, 'flat'),
  ('USD', 'TND', 130, 1.00, 10.00, 'flat'),
  ('USD', 'DZD', 140, 1.50, 12.00, 'flat'),
  ('USD', 'MZN', 150, 2.00, 15.00, 'flat'),
  ('USD', 'ZMW', 150, 2.00, 15.00, 'flat'),
  ('EUR', 'NGN', 160, 2.50, 18.00, 'flat'),
  ('EUR', 'GHS', 160, 2.50, 18.00, 'flat'),
  ('EUR', 'KES', 140, 2.00, 15.00, 'flat'),
  ('EUR', 'TZS', 150, 2.00, 15.00, 'flat'),
  ('EUR', 'ZAR', 130, 1.50, 12.00, 'flat'),
  ('EUR', 'XOF', 130, 1.50, 12.00, 'flat'),
  ('EUR', 'XAF', 130, 1.50, 12.00, 'flat'),
  ('EUR', 'EGP', 140, 1.50, 12.00, 'flat'),
  ('EUR', 'MAD', 120, 1.00, 10.00, 'flat'),
  ('GBP', 'NGN', 160, 2.50, 18.00, 'flat'),
  ('GBP', 'GHS', 160, 2.50, 18.00, 'flat'),
  ('GBP', 'KES', 150, 2.00, 15.00, 'flat'),
  ('GBP', 'TZS', 150, 2.00, 15.00, 'flat'),
  ('GBP', 'ZAR', 140, 1.50, 12.00, 'flat'),
  ('GBP', 'XOF', 150, 1.50, 12.00, 'flat'),
  ('GBP', 'EGP', 150, 1.50, 12.00, 'flat')
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- ── FX rate snapshots (audit/analytics) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS fx_rate_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10)     NOT NULL,
  to_currency   VARCHAR(10)     NOT NULL,
  rate          NUMERIC(24, 10) NOT NULL,
  provider      VARCHAR(50)     NOT NULL,
  fetched_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fx_rate_snapshots_corridor
  ON fx_rate_snapshots (from_currency, to_currency, fetched_at DESC);

-- ── FX quotes (locked rates for transaction processing) ───────────────────────
CREATE TABLE IF NOT EXISTS fx_quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10)     NOT NULL,
  to_currency   VARCHAR(10)     NOT NULL,
  amount        NUMERIC(18, 6)  NOT NULL,
  direction     VARCHAR(10)     NOT NULL CHECK (direction IN ('send', 'receive')),
  mid_rate      NUMERIC(24, 10) NOT NULL,
  customer_rate NUMERIC(24, 10) NOT NULL,
  markup_bps    INTEGER         NOT NULL,
  fee           NUMERIC(18, 6)  NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ     NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fx_quotes_expires_at
  ON fx_quotes (expires_at)
  WHERE used_at IS NULL;
