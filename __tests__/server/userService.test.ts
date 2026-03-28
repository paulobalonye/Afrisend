/**
 * User service tests — TDD
 *
 * Covers: DefaultUserService (profiles, recipients, tier progression).
 * Runs without a real database (in-memory implementation).
 */

import { DefaultUserService, TIER_LIMITS } from '@/server/services/userService';
import type { CreateRecipientInput, UpdateProfileInput } from '@/server/services/userService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOBILE_MONEY_DETAILS: CreateRecipientInput['accountDetails'] = {
  type: 'mobile_money',
  phoneNumber: '+2547001234567',
  provider: 'M-Pesa',
};

const BANK_DETAILS: CreateRecipientInput['accountDetails'] = {
  type: 'bank_transfer',
  accountNumber: '0690000031',
  bankCode: '044',
  bankName: 'Access Bank',
};

// ─── getProfile ───────────────────────────────────────────────────────────────

describe('DefaultUserService.getProfile', () => {
  it('returns a default profile for a new userId', async () => {
    const svc = new DefaultUserService();
    const profile = await svc.getProfile('user-1');

    expect(profile.id).toBe('user-1');
    expect(profile.kycTier).toBe(0);
    expect(profile.monthlyLimit).toBe(TIER_LIMITS[0]);
    expect(profile.notificationPreferences).toEqual({ email: true, sms: true, push: true });
    expect(profile.displayName).toBeNull();
    expect(profile.preferredCurrency).toBeNull();
    expect(profile.residenceCountry).toBeNull();
    expect(typeof profile.createdAt).toBe('string');
  });

  it('returns the same profile on subsequent calls (no duplicate creation)', async () => {
    const svc = new DefaultUserService();
    const p1 = await svc.getProfile('user-2');
    const p2 = await svc.getProfile('user-2');

    expect(p1.createdAt).toBe(p2.createdAt);
  });

  it('returns distinct profiles for different users', async () => {
    const svc = new DefaultUserService();
    const p1 = await svc.getProfile('user-A');
    const p2 = await svc.getProfile('user-B');

    expect(p1.id).not.toBe(p2.id);
  });
});

// ─── updateProfile ────────────────────────────────────────────────────────────

describe('DefaultUserService.updateProfile', () => {
  it('updates display name', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const updated = await svc.updateProfile('user-1', { displayName: 'Ada Obi' });

    expect(updated.displayName).toBe('Ada Obi');
  });

  it('updates residence country and preferred currency', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const updated = await svc.updateProfile('user-1', {
      residenceCountry: 'NG',
      preferredCurrency: 'NGN',
    });

    expect(updated.residenceCountry).toBe('NG');
    expect(updated.preferredCurrency).toBe('NGN');
  });

  it('merges notification preferences (partial update)', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const updated = await svc.updateProfile('user-1', {
      notificationPreferences: { sms: false },
    });

    expect(updated.notificationPreferences).toEqual({ email: true, sms: false, push: true });
  });

  it('preserves unrelated fields when updating', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    await svc.updateTierFromKyc('user-1', 2);
    const updated = await svc.updateProfile('user-1', { displayName: 'Changed' });

    expect(updated.kycTier).toBe(2);
    expect(updated.monthlyLimit).toBe(TIER_LIMITS[2]);
  });

  it('returns immutable copy (mutations do not affect stored state)', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const result = await svc.updateProfile('user-1', { displayName: 'Immutable Test' });
    // Mutate the returned object
    (result as Record<string, unknown>).displayName = 'MUTATED';

    const fetched = await svc.getProfile('user-1');
    expect(fetched.displayName).toBe('Immutable Test');
  });
});

// ─── Recipients: createRecipient ─────────────────────────────────────────────

describe('DefaultUserService.createRecipient', () => {
  it('creates a mobile money recipient', async () => {
    const svc = new DefaultUserService();
    const r = await svc.createRecipient('user-1', {
      name: 'John Doe',
      country: 'KE',
      payoutMethod: 'mobile_money',
      accountDetails: MOBILE_MONEY_DETAILS,
    });

    expect(r.id).toBeTruthy();
    expect(r.userId).toBe('user-1');
    expect(r.name).toBe('John Doe');
    expect(r.country).toBe('KE');
    expect(r.payoutMethod).toBe('mobile_money');
    expect(r.accountDetails).toEqual(MOBILE_MONEY_DETAILS);
    expect(typeof r.createdAt).toBe('string');
    expect(typeof r.updatedAt).toBe('string');
  });

  it('creates a bank transfer recipient', async () => {
    const svc = new DefaultUserService();
    const r = await svc.createRecipient('user-1', {
      name: 'Jane Ade',
      country: 'NG',
      payoutMethod: 'bank_transfer',
      accountDetails: BANK_DETAILS,
    });

    expect(r.payoutMethod).toBe('bank_transfer');
    expect(r.accountDetails).toEqual(BANK_DETAILS);
  });

  it('assigns unique ids to multiple recipients', async () => {
    const svc = new DefaultUserService();
    const r1 = await svc.createRecipient('user-1', {
      name: 'R1', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS,
    });
    const r2 = await svc.createRecipient('user-1', {
      name: 'R2', country: 'KE', payoutMethod: 'mobile_money', accountDetails: MOBILE_MONEY_DETAILS,
    });

    expect(r1.id).not.toBe(r2.id);
  });

  it('isolates recipients between users', async () => {
    const svc = new DefaultUserService();
    await svc.createRecipient('user-A', {
      name: 'R1', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS,
    });

    const recipientsB = await svc.listRecipients('user-B');
    expect(recipientsB).toHaveLength(0);
  });
});

// ─── Recipients: listRecipients ──────────────────────────────────────────────

describe('DefaultUserService.listRecipients', () => {
  it('returns empty array when user has no recipients', async () => {
    const svc = new DefaultUserService();
    const list = await svc.listRecipients('user-1');
    expect(list).toEqual([]);
  });

  it('returns all recipients for a user', async () => {
    const svc = new DefaultUserService();
    await svc.createRecipient('user-1', { name: 'R1', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS });
    await svc.createRecipient('user-1', { name: 'R2', country: 'KE', payoutMethod: 'mobile_money', accountDetails: MOBILE_MONEY_DETAILS });

    const list = await svc.listRecipients('user-1');
    expect(list).toHaveLength(2);
    expect(list.map(r => r.name)).toEqual(['R1', 'R2']);
  });
});

// ─── Recipients: updateRecipient ─────────────────────────────────────────────

describe('DefaultUserService.updateRecipient', () => {
  it('updates recipient name', async () => {
    const svc = new DefaultUserService();
    const created = await svc.createRecipient('user-1', {
      name: 'Old Name', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS,
    });

    const updated = await svc.updateRecipient('user-1', created.id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
    expect(updated.country).toBe('NG');
  });

  it('throws when recipient not found', async () => {
    const svc = new DefaultUserService();
    await expect(
      svc.updateRecipient('user-1', 'nonexistent-id', { name: 'X' }),
    ).rejects.toThrow('Recipient not found');
  });

  it('updates updatedAt on change', async () => {
    const svc = new DefaultUserService();
    const created = await svc.createRecipient('user-1', {
      name: 'R', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS,
    });

    // Ensure time difference
    await new Promise(resolve => setTimeout(resolve, 5));
    const updated = await svc.updateRecipient('user-1', created.id, { name: 'New' });
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );
  });

  it('returns immutable copy', async () => {
    const svc = new DefaultUserService();
    const created = await svc.createRecipient('user-1', {
      name: 'R', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS,
    });
    const updated = await svc.updateRecipient('user-1', created.id, { name: 'Immutable' });
    (updated as Record<string, unknown>).name = 'MUTATED';

    const list = await svc.listRecipients('user-1');
    expect(list[0].name).toBe('Immutable');
  });
});

// ─── Recipients: deleteRecipient ─────────────────────────────────────────────

describe('DefaultUserService.deleteRecipient', () => {
  it('removes recipient from list', async () => {
    const svc = new DefaultUserService();
    const r = await svc.createRecipient('user-1', {
      name: 'To Delete', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS,
    });

    await svc.deleteRecipient('user-1', r.id);
    const list = await svc.listRecipients('user-1');
    expect(list).toHaveLength(0);
  });

  it('only removes the targeted recipient', async () => {
    const svc = new DefaultUserService();
    const r1 = await svc.createRecipient('user-1', { name: 'Keep', country: 'NG', payoutMethod: 'bank_transfer', accountDetails: BANK_DETAILS });
    const r2 = await svc.createRecipient('user-1', { name: 'Delete', country: 'KE', payoutMethod: 'mobile_money', accountDetails: MOBILE_MONEY_DETAILS });

    await svc.deleteRecipient('user-1', r2.id);
    const list = await svc.listRecipients('user-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(r1.id);
  });

  it('throws when recipient not found', async () => {
    const svc = new DefaultUserService();
    await expect(svc.deleteRecipient('user-1', 'no-such-id')).rejects.toThrow('Recipient not found');
  });
});

// ─── Tier progression ────────────────────────────────────────────────────────

describe('DefaultUserService.updateTierFromKyc', () => {
  it('sets tier 1 with $500/mo limit', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const updated = await svc.updateTierFromKyc('user-1', 1);

    expect(updated.kycTier).toBe(1);
    expect(updated.monthlyLimit).toBe(500);
  });

  it('sets tier 2 with $5000/mo limit', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const updated = await svc.updateTierFromKyc('user-1', 2);

    expect(updated.kycTier).toBe(2);
    expect(updated.monthlyLimit).toBe(5000);
  });

  it('sets tier 3 with $25000/mo limit', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const updated = await svc.updateTierFromKyc('user-1', 3);

    expect(updated.kycTier).toBe(3);
    expect(updated.monthlyLimit).toBe(25000);
  });

  it('clamps tier to max 3', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    const updated = await svc.updateTierFromKyc('user-1', 99);

    expect(updated.kycTier).toBe(3);
    expect(updated.monthlyLimit).toBe(25000);
  });

  it('clamps tier to min 0', async () => {
    const svc = new DefaultUserService();
    await svc.getProfile('user-1');
    await svc.updateTierFromKyc('user-1', 2);
    const downgraded = await svc.updateTierFromKyc('user-1', -1);

    expect(downgraded.kycTier).toBe(0);
    expect(downgraded.monthlyLimit).toBe(0);
  });
});
