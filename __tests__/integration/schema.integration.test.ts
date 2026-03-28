/**
 * Schema Integration Tests — HIT-58
 *
 * Validates that all required AfriSend database tables exist with the correct
 * columns, constraints, and indexes after migrations are applied.
 *
 * Requires a running PostgreSQL instance (DATABASE_URL env var).
 * Skip individual tests gracefully when DB is unavailable.
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const HAS_DB = Boolean(DATABASE_URL);
const dbIt = HAS_DB ? it : it.skip;

let pool: Pool;

beforeAll(async () => {
  if (!HAS_DB) return;
  pool = new Pool({ connectionString: DATABASE_URL });
});

afterAll(async () => {
  if (pool) await pool.end();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function tableExists(tableName: string): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  return res.rows[0].exists;
}

async function columnExists(
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  );
  return res.rows[0].exists;
}

async function indexExists(indexName: string): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = $1
     ) AS exists`,
    [indexName],
  );
  return res.rows[0].exists;
}

async function constraintExists(
  tableName: string,
  constraintType: string,
): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = $1
         AND constraint_type = $2
     ) AS exists`,
    [tableName, constraintType],
  );
  return res.rows[0].exists;
}

// ---------------------------------------------------------------------------
// users table (001_initial_schema.sql)
// ---------------------------------------------------------------------------

describe('Schema: users table', () => {
  dbIt('exists', async () => {
    expect(await tableExists('users')).toBe(true);
  });

  dbIt.each([
    'id', 'phone', 'email', 'kyc_tier', 'kyc_status', 'created_at', 'updated_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('users', col)).toBe(true);
  });

  dbIt('has primary key', async () => {
    expect(await constraintExists('users', 'PRIMARY KEY')).toBe(true);
  });

  dbIt('has unique index on email (partial)', async () => {
    expect(await indexExists('users_email_unique')).toBe(true);
  });

  dbIt('has unique index on phone (partial)', async () => {
    expect(await indexExists('users_phone_unique')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// otp_sessions table (001_initial_schema.sql)
// ---------------------------------------------------------------------------

describe('Schema: otp_sessions table', () => {
  dbIt('exists', async () => {
    expect(await tableExists('otp_sessions')).toBe(true);
  });

  dbIt.each([
    'id', 'channel', 'code_hash', 'expires_at', 'attempts', 'created_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('otp_sessions', col)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// kyc_sessions table (001_initial_schema.sql — maps to "kyc_records" spec)
// ---------------------------------------------------------------------------

describe('Schema: kyc_sessions table', () => {
  dbIt('exists', async () => {
    expect(await tableExists('kyc_sessions')).toBe(true);
  });

  dbIt.each([
    'id', 'user_id', 'provider', 'status', 'created_at', 'updated_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('kyc_sessions', col)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// transactions table (001_initial_schema.sql)
// ---------------------------------------------------------------------------

describe('Schema: transactions table', () => {
  dbIt('exists', async () => {
    expect(await tableExists('transactions')).toBe(true);
  });

  dbIt.each([
    'id', 'user_id', 'provider', 'status', 'exchange_rate', 'fee', 'created_at', 'updated_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('transactions', col)).toBe(true);
  });

  dbIt('has index on user_id', async () => {
    expect(await indexExists('transactions_user_idx')).toBe(true);
  });

  dbIt('has index on status', async () => {
    expect(await indexExists('transactions_status_idx')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// bank_accounts table (002_bank_accounts.sql) — NEW
// ---------------------------------------------------------------------------

describe('Schema: bank_accounts table', () => {
  dbIt('exists', async () => {
    expect(await tableExists('bank_accounts')).toBe(true);
  });

  dbIt.each([
    'id', 'user_id', 'bank_code', 'account_number', 'account_name',
    'verified', 'verified_at', 'created_at', 'updated_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('bank_accounts', col)).toBe(true);
  });

  dbIt('has primary key', async () => {
    expect(await constraintExists('bank_accounts', 'PRIMARY KEY')).toBe(true);
  });

  dbIt('has index on user_id', async () => {
    expect(await indexExists('bank_accounts_user_idx')).toBe(true);
  });

  dbIt('enforces foreign key to users', async () => {
    expect(await constraintExists('bank_accounts', 'FOREIGN KEY')).toBe(true);
  });

  dbIt('rejects duplicate account per user', async () => {
    // Unique constraint: (user_id, bank_code, account_number)
    const res = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'bank_accounts'
           AND indexname = 'bank_accounts_unique_account'
       ) AS exists`,
    );
    expect(res.rows[0].exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// webhook_events table (003_webhook_events.sql) — NEW
// ---------------------------------------------------------------------------

describe('Schema: webhook_events table', () => {
  dbIt('exists', async () => {
    expect(await tableExists('webhook_events')).toBe(true);
  });

  dbIt.each([
    'id', 'provider', 'event_type', 'payload', 'processed', 'created_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('webhook_events', col)).toBe(true);
  });

  dbIt('has primary key', async () => {
    expect(await constraintExists('webhook_events', 'PRIMARY KEY')).toBe(true);
  });

  dbIt('has index on provider + processed for queue processing', async () => {
    expect(await indexExists('webhook_events_unprocessed_idx')).toBe(true);
  });

  dbIt('payload column is JSONB type', async () => {
    const res = await pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'webhook_events'
         AND column_name = 'payload'`,
    );
    expect(res.rows[0]?.data_type).toBe('jsonb');
  });

  dbIt('processed defaults to false', async () => {
    const res = await pool.query<{ column_default: string }>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'webhook_events'
         AND column_name = 'processed'`,
    );
    expect(res.rows[0]?.column_default).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// audit_log table (004_audit_log_revision.sql) — REVISED
// ---------------------------------------------------------------------------

describe('Schema: audit_log table', () => {
  dbIt('exists', async () => {
    expect(await tableExists('audit_log')).toBe(true);
  });

  dbIt.each([
    'id', 'action', 'actor_id', 'entity_type', 'entity_id', 'metadata', 'created_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('audit_log', col)).toBe(true);
  });

  dbIt('metadata column is JSONB type', async () => {
    const res = await pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'audit_log'
         AND column_name = 'metadata'`,
    );
    expect(res.rows[0]?.data_type).toBe('jsonb');
  });

  dbIt('has index on entity_type + entity_id for lookups', async () => {
    expect(await indexExists('audit_log_entity_idx')).toBe(true);
  });

  dbIt('has index on actor_id for user activity queries', async () => {
    expect(await indexExists('audit_log_actor_idx')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Migration 005: version + deleted_at columns (audit columns spec §3.2)
// ---------------------------------------------------------------------------

describe('Schema: version column (optimistic locking) — migration 005', () => {
  dbIt.each(['users', 'transactions', 'kyc_sessions'])(
    '%s has version column',
    async (table) => {
      expect(await columnExists(table, 'version')).toBe(true);
    },
  );

  dbIt('version defaults to 1 on users', async () => {
    const res = await pool.query<{ column_default: string }>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'version'`,
    );
    expect(res.rows[0]?.column_default).toBe('1');
  });

  dbIt('version defaults to 1 on transactions', async () => {
    const res = await pool.query<{ column_default: string }>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'version'`,
    );
    expect(res.rows[0]?.column_default).toBe('1');
  });

  dbIt('version defaults to 1 on kyc_sessions', async () => {
    const res = await pool.query<{ column_default: string }>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'kyc_sessions' AND column_name = 'version'`,
    );
    expect(res.rows[0]?.column_default).toBe('1');
  });
});

describe('Schema: deleted_at column (soft delete) — migration 005', () => {
  dbIt.each(['users', 'transactions', 'bank_accounts'])(
    '%s has deleted_at column',
    async (table) => {
      expect(await columnExists(table, 'deleted_at')).toBe(true);
    },
  );

  dbIt('deleted_at is nullable on users', async () => {
    const res = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'deleted_at'`,
    );
    expect(res.rows[0]?.is_nullable).toBe('YES');
  });
});

// ---------------------------------------------------------------------------
// Migration 005: transactions money fields as BIGINT
// ---------------------------------------------------------------------------

describe('Schema: transactions money fields are BIGINT — migration 005', () => {
  dbIt.each(['source_amount', 'destination_amount', 'fee'])(
    '%s column is bigint',
    async (col) => {
      const res = await pool.query<{ data_type: string }>(
        `SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = $1`,
        [col],
      );
      expect(res.rows[0]?.data_type).toBe('bigint');
    },
  );
});

// ---------------------------------------------------------------------------
// Migration 005: compliance columns on transactions
// ---------------------------------------------------------------------------

describe('Schema: transactions compliance columns — migration 005', () => {
  dbIt('has compliance_status column', async () => {
    expect(await columnExists('transactions', 'compliance_status')).toBe(true);
  });

  dbIt('compliance_status defaults to pending', async () => {
    const res = await pool.query<{ column_default: string }>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'compliance_status'`,
    );
    expect(res.rows[0]?.column_default).toBe("'pending'::text");
  });

  dbIt('has risk_score column', async () => {
    expect(await columnExists('transactions', 'risk_score')).toBe(true);
  });

  dbIt('risk_score is nullable', async () => {
    const res = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'risk_score'`,
    );
    expect(res.rows[0]?.is_nullable).toBe('YES');
  });
});

// ---------------------------------------------------------------------------
// Migration 005: recipients table
// ---------------------------------------------------------------------------

describe('Schema: recipients table — migration 005', () => {
  dbIt('exists', async () => {
    expect(await tableExists('recipients')).toBe(true);
  });

  dbIt.each([
    'id', 'user_id', 'nickname', 'country', 'payout_method',
    'account_details_encrypted', 'created_at', 'updated_at',
  ])('has column: %s', async (col) => {
    expect(await columnExists('recipients', col)).toBe(true);
  });

  dbIt('has primary key', async () => {
    expect(await constraintExists('recipients', 'PRIMARY KEY')).toBe(true);
  });

  dbIt('enforces foreign key to users', async () => {
    expect(await constraintExists('recipients', 'FOREIGN KEY')).toBe(true);
  });

  dbIt('has index on user_id', async () => {
    expect(await indexExists('recipients_user_idx')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Migration 005: partial indexes on transactions
// ---------------------------------------------------------------------------

describe('Schema: transactions partial indexes — migration 005', () => {
  dbIt('has idx_txn_status partial index (active statuses only)', async () => {
    expect(await indexExists('idx_txn_status')).toBe(true);
  });

  dbIt('has idx_txn_compliance partial index (flagged only)', async () => {
    expect(await indexExists('idx_txn_compliance')).toBe(true);
  });

  dbIt('idx_txn_status is a partial index', async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'idx_txn_status'`,
    );
    expect(res.rows[0]?.indexdef).toContain('WHERE');
  });

  dbIt('idx_txn_compliance is a partial index', async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'idx_txn_compliance'`,
    );
    expect(res.rows[0]?.indexdef).toContain('WHERE');
  });
});
