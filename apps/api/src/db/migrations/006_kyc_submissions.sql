-- Migration 006: KYC submissions table for Smile Identity integration
-- Stores per-submission records that can be polled or updated via webhook.

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier               SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  provider           TEXT NOT NULL DEFAULT 'smile_identity',
  provider_reference TEXT,          -- Smile Identity SmileJobID
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'more_info_needed')),
  rejection_reason   TEXT,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_submissions_user_idx
  ON kyc_submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS kyc_submissions_provider_ref_idx
  ON kyc_submissions (provider_reference)
  WHERE provider_reference IS NOT NULL;

-- kyc_documents already exists (from 001_initial_schema.sql referencing kyc_sessions).
-- Add a nullable submission_id column so docs can be linked to either old sessions
-- or new submissions, and add a file_url column for direct-upload references.

ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES kyc_submissions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_url TEXT;

-- updated_at trigger for kyc_submissions

CREATE TRIGGER kyc_submissions_updated_at
  BEFORE UPDATE ON kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
