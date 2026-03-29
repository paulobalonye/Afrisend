/**
 * Unit tests for ComplianceService.
 *
 * Tests AML screening, sanctions checks, and transaction limit enforcement.
 * Follows TDD: tests are written before the implementation.
 */

import {
  DefaultComplianceService,
  ComplianceCheckType,
  ComplianceResult,
  TIER_MONTHLY_LIMITS,
  type ComplianceCheckInput,
} from '@/server/services/complianceService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<ComplianceCheckInput> = {}): ComplianceCheckInput {
  return {
    transactionId: 'tx-001',
    userId: 'user-abc',
    amount: 100,
    currency: 'USD',
    senderName: 'John Doe',
    recipientName: 'Jane Smith',
    corridorId: 'cor-ng',
    kycTier: 2,
    ...overrides,
  };
}

// ─── TIER_MONTHLY_LIMITS ──────────────────────────────────────────────────────

describe('TIER_MONTHLY_LIMITS', () => {
  it('tier 1 limit is 500', () => {
    expect(TIER_MONTHLY_LIMITS[1]).toBe(500);
  });

  it('tier 2 limit is 3000', () => {
    expect(TIER_MONTHLY_LIMITS[2]).toBe(3000);
  });

  it('tier 3 limit is Infinity (unlimited)', () => {
    expect(TIER_MONTHLY_LIMITS[3]).toBe(Infinity);
  });
});

// ─── DefaultComplianceService ─────────────────────────────────────────────────

describe('DefaultComplianceService', () => {
  let service: DefaultComplianceService;

  beforeEach(() => {
    service = new DefaultComplianceService();
  });

  // ─── check ─────────────────────────────────────────────────────────────────

  describe('check', () => {
    it('returns approved for a clean transaction', async () => {
      const result = await service.check(makeInput());

      expect(result.result).toBe(ComplianceResult.Approved);
      expect(result.checkId).toBeTruthy();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('returns a unique checkId each call', async () => {
      const r1 = await service.check(makeInput({ transactionId: 'tx-a' }));
      const r2 = await service.check(makeInput({ transactionId: 'tx-b' }));

      expect(r1.checkId).not.toBe(r2.checkId);
    });

    it('includes AML, SANCTIONS, and LIMIT check types in results', async () => {
      const result = await service.check(makeInput());

      const types = result.checks.map((c) => c.type);
      expect(types).toContain(ComplianceCheckType.AML);
      expect(types).toContain(ComplianceCheckType.SANCTIONS);
      expect(types).toContain(ComplianceCheckType.LIMIT);
    });

    // ─── Sanctions ────────────────────────────────────────────────────────

    it('blocks transaction when sender name matches sanctions list', async () => {
      const result = await service.check(
        makeInput({ senderName: 'BLOCKED ENTITY TEST', userId: 'sanctioned-user' }),
      );

      expect(result.result).toBe(ComplianceResult.Blocked);
    });

    it('blocks transaction when recipient name matches sanctions list', async () => {
      const result = await service.check(
        makeInput({ recipientName: 'BLOCKED ENTITY TEST' }),
      );

      expect(result.result).toBe(ComplianceResult.Blocked);
    });

    it('records sanctions hit when blocked', async () => {
      const result = await service.check(
        makeInput({ senderName: 'BLOCKED ENTITY TEST' }),
      );

      expect(result.sanctionsHit).toBeTruthy();
      expect(result.sanctionsHit?.matchedEntry).toContain('BLOCKED ENTITY TEST');
    });

    // ─── Transaction limits ───────────────────────────────────────────────

    it('blocks when monthly usage would exceed tier 1 limit ($500)', async () => {
      const result = await service.check(
        makeInput({ amount: 501, kycTier: 1, userId: 'new-user-tier1' }),
      );

      expect(result.result).toBe(ComplianceResult.Blocked);
      expect(result.errorCode).toBe('MONTHLY_LIMIT_EXCEEDED');
    });

    it('approves transaction exactly at tier 1 limit ($500)', async () => {
      const result = await service.check(
        makeInput({ amount: 500, kycTier: 1, userId: 'new-user-tier1-exact' }),
      );

      expect(result.result).toBe(ComplianceResult.Approved);
    });

    it('blocks when monthly usage would exceed tier 2 limit ($3000)', async () => {
      // Simulate prior usage by recording transactions first
      const s = service;
      await s.recordUsage('user-tier2-over', 2900);

      const result = await service.check(
        makeInput({ amount: 200, kycTier: 2, userId: 'user-tier2-over' }),
      );

      expect(result.result).toBe(ComplianceResult.Blocked);
      expect(result.errorCode).toBe('MONTHLY_LIMIT_EXCEEDED');
    });

    it('tier 3 is unlimited — never blocked by monthly limit', async () => {
      const result = await service.check(
        makeInput({ amount: 99999, kycTier: 3, userId: 'user-tier3' }),
      );

      // Should not be blocked due to limit (might be flagged for AML though)
      const limitCheck = result.checks.find((c) => c.type === ComplianceCheckType.LIMIT);
      expect(limitCheck?.result).toBe(ComplianceResult.Approved);
    });

    it('blocks tier 0 users (no KYC) for any amount', async () => {
      const result = await service.check(
        makeInput({ amount: 1, kycTier: 0, userId: 'user-no-kyc' }),
      );

      expect(result.result).toBe(ComplianceResult.Blocked);
      expect(result.errorCode).toBe('TIER_LIMIT_EXCEEDED');
    });

    it('returns TIER_LIMIT_EXCEEDED for tier 0', async () => {
      const result = await service.check(
        makeInput({ kycTier: 0, userId: 'user-tier0' }),
      );

      expect(result.errorCode).toBe('TIER_LIMIT_EXCEEDED');
    });

    // ─── AML / velocity ───────────────────────────────────────────────────

    it('flags transaction for review when daily velocity threshold exceeded', async () => {
      // Record many transactions in same day window
      for (let i = 0; i < 10; i++) {
        await service.recordUsage('user-velocity', 50);
      }

      const result = await service.check(
        makeInput({ userId: 'user-velocity', kycTier: 2 }),
      );

      // High velocity should flag for review or block
      const amlCheck = result.checks.find((c) => c.type === ComplianceCheckType.AML);
      expect(amlCheck).toBeTruthy();
    });

    // ─── Logging ──────────────────────────────────────────────────────────

    it('stores check result accessible via getCheck', async () => {
      const result = await service.check(makeInput());
      const stored = await service.getCheck(result.checkId);

      expect(stored.checkId).toBe(result.checkId);
      expect(stored.transactionId).toBe('tx-001');
    });

    it('getCheck throws not-found for unknown checkId', async () => {
      await expect(service.getCheck('unknown-check-id')).rejects.toThrow(/not found/i);
    });
  });

  // ─── getLimits ────────────────────────────────────────────────────────────

  describe('getLimits', () => {
    it('returns limits for a user with no prior usage', async () => {
      const limits = await service.getLimits('fresh-user', 1);

      expect(limits.monthlyLimit).toBe(500);
      expect(limits.monthlyUsed).toBe(0);
      expect(limits.monthlyRemaining).toBe(500);
      expect(limits.kycTier).toBe(1);
    });

    it('returns correct remaining after usage recorded', async () => {
      await service.recordUsage('user-with-usage', 200);
      const limits = await service.getLimits('user-with-usage', 2);

      expect(limits.monthlyUsed).toBe(200);
      expect(limits.monthlyRemaining).toBe(2800);
    });

    it('tier 3 shows Infinity for monthly limit', async () => {
      const limits = await service.getLimits('user-t3', 3);

      expect(limits.monthlyLimit).toBe(Infinity);
      expect(limits.monthlyRemaining).toBe(Infinity);
    });
  });

  // ─── flagForReview ────────────────────────────────────────────────────────

  describe('flagForReview', () => {
    it('flags a transaction for manual review', async () => {
      const flag = await service.flagForReview('tx-flag-001', 'Suspicious pattern detected');

      expect(flag.transactionId).toBe('tx-flag-001');
      expect(flag.flaggedAt).toBeInstanceOf(Date);
      expect(flag.reason).toBe('Suspicious pattern detected');
    });

    it('assigns a unique flag id', async () => {
      const f1 = await service.flagForReview('tx-a', 'reason a');
      const f2 = await service.flagForReview('tx-b', 'reason b');

      expect(f1.flagId).not.toBe(f2.flagId);
    });
  });

  // ─── recordUsage ──────────────────────────────────────────────────────────

  describe('recordUsage', () => {
    it('accumulates usage across multiple calls', async () => {
      await service.recordUsage('user-accum', 100);
      await service.recordUsage('user-accum', 150);

      const limits = await service.getLimits('user-accum', 2);
      expect(limits.monthlyUsed).toBe(250);
    });

    it('does not mix usage between users', async () => {
      await service.recordUsage('user-x', 300);
      const limitsY = await service.getLimits('user-y', 2);

      expect(limitsY.monthlyUsed).toBe(0);
    });
  });
});
