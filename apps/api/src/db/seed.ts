/**
 * Local development seed data.
 *
 * Creates a test user and sample KYC/transaction records
 * so the mobile app has data to work with immediately after
 * docker-compose up.
 *
 * Run with: npx ts-node src/server/db/seed.ts
 * Safe to run multiple times (upserts on stable IDs).
 */

import 'dotenv/config';
import { getPool, closePool } from './pool';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_2_ID = '00000000-0000-0000-0000-000000000002';

async function seedUsers(): Promise<void> {
  await getPool().query(
    `INSERT INTO users (id, phone, email, first_name, last_name, kyc_tier, kyc_status,
                        date_of_birth, nationality, residence_country, purpose)
     VALUES
       ($1, '+2348012345678', 'ada@example.com',   'Ada',   'Obi',    1, 'approved',
        '1990-05-15', 'NG', 'GB', 'family'),
       ($2, '+447911123456',  'kwame@example.com', 'Kwame', 'Mensah', 0, 'none',
        NULL, NULL, NULL, NULL)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER_ID, TEST_USER_2_ID],
  );
  console.log('[seed] users');
}

async function seedKycSession(): Promise<void> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO kyc_sessions (user_id, provider, tier, status)
     VALUES ($1, 'veriff', 1, 'approved')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [TEST_USER_ID],
  );

  if (rows.length > 0) {
    console.log('[seed] kyc_sessions');
  }
}

async function seedTransactions(): Promise<void> {
  await getPool().query(
    `INSERT INTO transactions
       (user_id, idempotency_key, provider, corridor_id,
        source_currency, destination_currency,
        source_amount, destination_amount, exchange_rate, fee,
        status, recipient_name, recipient_account, recipient_bank_code, recipient_bank_name)
     VALUES
       ($1, 'seed-tx-1', 'yellowcard', 'cor-ng',
        'USDC', 'NGN',
        100, 150000, 1500, 2,
        'completed', 'JOHN DOE', '0690000031', '044', 'Access Bank'),
       ($1, 'seed-tx-2', 'yellowcard', 'cor-gh',
        'USDC', 'GHS',
        50, 700, 14, 1,
        'pending', 'AKOSUA MENSAH', '001234567', 'GCB', 'GCB Bank')
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [TEST_USER_ID],
  );
  console.log('[seed] transactions');
}

async function runSeed(): Promise<void> {
  console.log('[seed] starting...');
  await seedUsers();
  await seedKycSession();
  await seedTransactions();
  console.log('[seed] done');
}

if (require.main === module) {
  runSeed()
    .then(() => closePool())
    .catch((err) => {
      console.error('[seed] error:', err.message);
      process.exit(1);
    });
}
