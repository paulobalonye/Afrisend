-- Migration 003: webhook_events table
-- Stores raw inbound webhook payloads from payment/KYC providers for
-- idempotent, auditable event processing.

CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed    BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for efficient queue polling (only unprocessed rows)
CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx
  ON webhook_events (provider, created_at ASC)
  WHERE processed = FALSE;
