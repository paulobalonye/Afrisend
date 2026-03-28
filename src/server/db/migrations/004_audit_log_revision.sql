-- Migration 004: Revise audit_log to entity-level change tracking
--
-- The initial schema (001) created audit_log as a service-call log
-- (service, operation, request_id, etc.).  This migration replaces it with
-- an entity-audit table that records PII-safe structured change events
-- per the AfriSend data model spec.

DROP TABLE IF EXISTS audit_log;

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  action      TEXT NOT NULL,           -- e.g. 'user.kyc_approved', 'transaction.completed'
  actor_id    UUID,                    -- user or agent that triggered the action (nullable for system events)
  entity_type TEXT NOT NULL,           -- e.g. 'user', 'transaction', 'kyc_session'
  entity_id   TEXT NOT NULL,           -- UUID or other identifier of the affected entity
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- PII-safe contextual data
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx
  ON audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx
  ON audit_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;
