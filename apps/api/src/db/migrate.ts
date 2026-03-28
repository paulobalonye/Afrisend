/**
 * Database migration runner.
 *
 * Reads all *.sql files from the migrations directory in order
 * and applies any that have not yet been recorded in the migrations table.
 *
 * Run with: npx ts-node src/server/db/migrate.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getPool, closePool } from './pool';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await getPool().query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  return new Set(result.rows.map((r) => r.version));
}

async function applyMigration(version: string, sql: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query('COMMIT');
    console.log(`[migrate] applied ${version}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace('.sql', '');
    if (applied.has(version)) {
      console.log(`[migrate] skipping ${version} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await applyMigration(version, sql);
  }

  console.log('[migrate] done');
}

// Run when executed directly
if (require.main === module) {
  runMigrations()
    .then(() => closePool())
    .catch((err) => {
      console.error('[migrate] error:', err.message);
      process.exit(1);
    });
}
