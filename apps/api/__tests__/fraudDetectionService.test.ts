/**
 * Unit tests for FraudDetectionService (apps/api ts-jest suite).
 *
 * Tests velocity checks, device fingerprinting, behavioral anomaly detection,
 * risk scoring, and automated action selection.
 */

import {
  DefaultFraudDetectionService,
  FraudAction,
  FraudCheckType,
  FraudRiskLevel,
  RISK_THRESHOLDS,
  type FraudAssessmentInput,
} from '../src/services/fraudDetectionService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<FraudAssessmentInput> = {}): FraudAssessmentInput {
  return {
    transactionId: 'tx-001',
    userId: 'user-abc',
    amount: 100,
    currency: 'USD',
    recipientId: 'recip-001',
    corridorId: 'cor-ng',
    deviceId: 'device-001',
    ipAddress: '1.2.3.4',
    userAgent: 'TestBrowser/1.0',
    hour: 12, // midday — not off-hours
    ...overrides,
  };
}

// ─── RISK_THRESHOLDS ──────────────────────────────────────────────────────────

describe('RISK_THRESHOLDS', () => {
  it('low threshold is 25', () => expect(RISK_THRESHOLDS.low).toBe(25));
  it('medium threshold is 50', () => expect(RISK_THRESHOLDS.medium).toBe(50));
  it('high threshold is 75', () => expect(RISK_THRESHOLDS.high).toBe(75));
});

// ─── DefaultFraudDetectionService — basic assess ─────────────────────────────

describe('DefaultFraudDetectionService', () => {
  let svc: DefaultFraudDetectionService;

  beforeEach(() => {
    svc = new DefaultFraudDetectionService();
  });

  describe('assess — basic shape', () => {
    it('returns an assessment result with required fields', async () => {
      const result = await svc.assess(makeInput());

      expect(result).toMatchObject({
        transactionId: 'tx-001',
        userId: 'user-abc',
      });
      expect(typeof result.assessmentId).toBe('string');
      expect(typeof result.riskScore).toBe('number');
      expect(result.checks).toHaveLength(3);
      expect(result.decidedAt).toBeInstanceOf(Date);
    });

    it('check types are velocity, device, and behavioral', async () => {
      const result = await svc.assess(makeInput());
      const types = result.checks.map(c => c.type);

      expect(types).toContain(FraudCheckType.Velocity);
      expect(types).toContain(FraudCheckType.Device);
      expect(types).toContain(FraudCheckType.Behavioral);
    });

    it('riskScore is the max of sub-check scores', async () => {
      const result = await svc.assess(makeInput());
      const maxSubScore = Math.max(...result.checks.map(c => c.riskScore));
      expect(result.riskScore).toBe(maxSubScore);
    });

    it('riskScore is capped at 100', async () => {
      const result = await svc.assess(makeInput({ amount: 999999, hour: 2 }));
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('is idempotent — same transactionId returns the same result', async () => {
      const first = await svc.assess(makeInput());
      const second = await svc.assess(makeInput());
      expect(second).toBe(first); // same object reference
    });

    it('different transactionIds produce independent results', async () => {
      const a = await svc.assess(makeInput({ transactionId: 'tx-A' }));
      const b = await svc.assess(makeInput({ transactionId: 'tx-B' }));
      expect(a).not.toBe(b);
    });
  });

  // ─── Risk level mapping ────────────────────────────────────────────────────

  describe('risk level and action', () => {
    it('score below low threshold → Low + Approve', async () => {
      // Fresh device gives 20 pts for device check, but midday/small amount gives 0 behavioral
      // Velocity is 0 for first tx — total max is 20 which is < 25
      const result = await svc.assess(makeInput({ amount: 50, hour: 12 }));

      // New device scores 20 which is below 25 low threshold
      expect(result.riskLevel).toBe(FraudRiskLevel.Low);
      expect(result.action).toBe(FraudAction.Approve);
    });

    it('score >= low threshold but < medium → Medium + Review', async () => {
      // Midday, modest amount, new recipient (15) + new device (20) = 20 max → Low
      // Need to push over 25: use off-hours (30) to get Review
      const result = await svc.assess(makeInput({ hour: 0, amount: 50 }));

      expect(result.riskScore).toBeGreaterThanOrEqual(RISK_THRESHOLDS.low);
      expect(result.riskScore).toBeLessThan(RISK_THRESHOLDS.medium);
      expect(result.riskLevel).toBe(FraudRiskLevel.Medium);
      expect(result.action).toBe(FraudAction.Review);
    });

    it('score >= medium threshold but < high → High + Flag', async () => {
      // Device used by a different user scores 60 (> 50 medium, < 75 high) → Flag
      const deviceId = 'shared-flag-device';
      await svc.assess(makeInput({ transactionId: 'tx-flag-pre', deviceId, userId: 'user-owner-flag' }));

      const result = await svc.assess(makeInput({ transactionId: 'tx-flag', deviceId, userId: 'user-thief-flag', amount: 50, hour: 12 }));

      expect(result.riskScore).toBeGreaterThanOrEqual(RISK_THRESHOLDS.medium);
      expect(result.riskScore).toBeLessThan(RISK_THRESHOLDS.high);
      expect(result.riskLevel).toBe(FraudRiskLevel.High);
      expect(result.action).toBe(FraudAction.Flag);
    });

    it('score >= high threshold → Critical + Block', async () => {
      // Exceed user velocity limit (10 tx/hr) to trigger 80 score
      const input = makeInput({ userId: 'heavy-user', ipAddress: '9.9.9.9' });

      // Send 10 prior transactions to saturate the velocity counter
      for (let i = 0; i < 10; i++) {
        await svc.assess(makeInput({ transactionId: `tx-pre-${i}`, userId: 'heavy-user', ipAddress: '9.9.9.9' }));
      }

      const result = await svc.assess({ ...input, transactionId: 'tx-block-trigger' });

      expect(result.riskScore).toBeGreaterThanOrEqual(RISK_THRESHOLDS.high);
      expect(result.riskLevel).toBe(FraudRiskLevel.Critical);
      expect(result.action).toBe(FraudAction.Block);
    });
  });

  // ─── reasonCodes ──────────────────────────────────────────────────────────

  describe('reasonCodes', () => {
    it('includes reason codes only for checks that exceed low threshold', async () => {
      const result = await svc.assess(makeInput({ hour: 0 })); // off-hours = 30 risk
      // Behavioral check ≥ 25 → BEHAVIORAL_RISK in reasonCodes
      expect(result.reasonCodes).toContain('BEHAVIORAL_RISK');
    });

    it('has no reason codes when all sub-check scores are below low threshold', async () => {
      // Already-known device with >3 txs + midday + small amount + known recipient
      const userId = 'clean-user';
      const deviceId = 'trusted-device';

      // Build trust: 3+ transactions with same user/device/recipient
      for (let i = 0; i < 4; i++) {
        await svc.assess(makeInput({
          transactionId: `tx-setup-${i}`,
          userId,
          deviceId,
          recipientId: 'recip-known',
          amount: 50,
          hour: 12,
        }));
      }

      const result = await svc.assess(makeInput({
        transactionId: 'tx-clean',
        userId,
        deviceId,
        recipientId: 'recip-known',
        amount: 50,
        hour: 12,
      }));

      expect(result.reasonCodes).toHaveLength(0);
    });
  });

  // ─── Velocity check ───────────────────────────────────────────────────────

  describe('velocity check', () => {
    it('first transaction within velocity limits scores 0 on velocity', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-v1' }));
      const velocityCheck = result.checks.find(c => c.type === FraudCheckType.Velocity)!;
      expect(velocityCheck.riskScore).toBe(0);
    });

    it('approaching user velocity limit (≥70%) scores at warning level', async () => {
      const userId = 'user-v2';
      // Send 7 transactions (70% of limit 10)
      for (let i = 0; i < 7; i++) {
        await svc.assess(makeInput({ transactionId: `tx-v2-pre-${i}`, userId }));
      }
      const result = await svc.assess(makeInput({ transactionId: 'tx-v2-warn', userId }));
      const velocityCheck = result.checks.find(c => c.type === FraudCheckType.Velocity)!;
      expect(velocityCheck.riskScore).toBe(40);
    });

    it('exceeding user velocity limit scores 80', async () => {
      const userId = 'user-v3';
      for (let i = 0; i < 10; i++) {
        await svc.assess(makeInput({ transactionId: `tx-v3-pre-${i}`, userId }));
      }
      const result = await svc.assess(makeInput({ transactionId: 'tx-v3-over', userId }));
      const velocityCheck = result.checks.find(c => c.type === FraudCheckType.Velocity)!;
      expect(velocityCheck.riskScore).toBe(80);
    });

    it('exceeding IP velocity limit scores 75', async () => {
      const ipAddress = '5.5.5.5';
      for (let i = 0; i < 10; i++) {
        await svc.assess(makeInput({ transactionId: `tx-ip-pre-${i}`, userId: `user-ip-${i}`, ipAddress }));
      }
      const result = await svc.assess(makeInput({ transactionId: 'tx-ip-over', userId: 'user-ip-final', ipAddress }));
      const velocityCheck = result.checks.find(c => c.type === FraudCheckType.Velocity)!;
      expect(velocityCheck.riskScore).toBeGreaterThanOrEqual(75);
    });

    it('exceeding corridor velocity limit scores 70', async () => {
      const userId = 'user-cor';
      const corridorId = 'cor-gh';
      for (let i = 0; i < 8; i++) {
        await svc.assess(makeInput({ transactionId: `tx-cor-pre-${i}`, userId, corridorId }));
      }
      const result = await svc.assess(makeInput({ transactionId: 'tx-cor-over', userId, corridorId }));
      const velocityCheck = result.checks.find(c => c.type === FraudCheckType.Velocity)!;
      expect(velocityCheck.riskScore).toBeGreaterThanOrEqual(70);
    });

    it('null corridorId does not error and has no corridor signal', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-no-cor', corridorId: null }));
      const velocityCheck = result.checks.find(c => c.type === FraudCheckType.Velocity)!;
      expect(velocityCheck).toBeDefined();
      expect(velocityCheck.detail).not.toMatch(/corridor/);
    });
  });

  // ─── Device check ─────────────────────────────────────────────────────────

  describe('device check', () => {
    it('unknown device scores 20', async () => {
      const result = await svc.assess(makeInput({ deviceId: 'brand-new-device' }));
      const deviceCheck = result.checks.find(c => c.type === FraudCheckType.Device)!;
      expect(deviceCheck.riskScore).toBe(20);
      expect(deviceCheck.detail).toMatch(/New\/unknown device/);
    });

    it('familiar device (< trust threshold) scores 15', async () => {
      const deviceId = 'device-familiar';
      const userId = 'user-fam';

      // 1 prior transaction (below trust threshold of 3)
      await svc.assess(makeInput({ transactionId: 'tx-fam-1', deviceId, userId }));

      const result = await svc.assess(makeInput({ transactionId: 'tx-fam-2', deviceId, userId }));
      const deviceCheck = result.checks.find(c => c.type === FraudCheckType.Device)!;
      expect(deviceCheck.riskScore).toBe(15);
    });

    it('trusted device (≥ trust threshold) scores 5', async () => {
      const deviceId = 'device-trusted';
      const userId = 'user-trust';

      for (let i = 0; i < 3; i++) {
        await svc.assess(makeInput({ transactionId: `tx-trust-${i}`, deviceId, userId }));
      }

      const result = await svc.assess(makeInput({ transactionId: 'tx-trust-final', deviceId, userId }));
      const deviceCheck = result.checks.find(c => c.type === FraudCheckType.Device)!;
      expect(deviceCheck.riskScore).toBe(5);
    });

    it('device used by a different user scores 60', async () => {
      const deviceId = 'shared-device';
      await svc.assess(makeInput({ transactionId: 'tx-d1', deviceId, userId: 'user-owner' }));

      const result = await svc.assess(makeInput({ transactionId: 'tx-d2', deviceId, userId: 'user-thief' }));
      const deviceCheck = result.checks.find(c => c.type === FraudCheckType.Device)!;
      expect(deviceCheck.riskScore).toBe(60);
    });
  });

  // ─── Behavioral check ─────────────────────────────────────────────────────

  describe('behavioral check', () => {
    it('no anomalies → behavioral riskScore is 0', async () => {
      const userId = 'user-normal';
      // Establish known recipient first
      await svc.assess(makeInput({ transactionId: 'tx-setup', userId, recipientId: 'recip-known', amount: 50, hour: 12 }));

      const result = await svc.assess(makeInput({
        transactionId: 'tx-normal',
        userId,
        recipientId: 'recip-known',
        amount: 50,
        hour: 12,
      }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.riskScore).toBe(0);
      expect(behavCheck.detail).toBe('No behavioral anomalies detected');
    });

    it('off-hours at hour 23 scores at least 30', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-23h', hour: 23, amount: 50 }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.riskScore).toBeGreaterThanOrEqual(30);
      expect(behavCheck.detail).toMatch(/off-hours/);
    });

    it('off-hours at hour 3 scores at least 30', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-3h', hour: 3, amount: 50 }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('off-hours at hour 6 scores at least 30', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-6h', hour: 6, amount: 50 }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('large amount (> 2000) scores at least 40', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-large', amount: 2500, hour: 12 }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.riskScore).toBeGreaterThanOrEqual(40);
      expect(behavCheck.detail).toMatch(/large amount/);
    });

    it('elevated amount (> 1000, ≤ 2000) scores at least 15', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-elevated', amount: 1500, hour: 12 }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.riskScore).toBeGreaterThanOrEqual(15);
      expect(behavCheck.detail).toMatch(/elevated amount/);
    });

    it('new recipient scores at least 15', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-newrecip', recipientId: 'brand-new-recip', hour: 12, amount: 50 }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.riskScore).toBeGreaterThanOrEqual(15);
      expect(behavCheck.detail).toMatch(/new\/unknown recipient/);
    });

    it('no recipient → no new-recipient signal', async () => {
      const result = await svc.assess(makeInput({ transactionId: 'tx-norecip', recipientId: null, hour: 12, amount: 50 }));
      const behavCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(behavCheck.detail).not.toMatch(/recipient/);
    });
  });

  // ─── getDecision ──────────────────────────────────────────────────────────

  describe('getDecision', () => {
    it('returns null for unknown transactionId', async () => {
      const result = await svc.getDecision('does-not-exist');
      expect(result).toBeNull();
    });

    it('returns the stored assessment after assess is called', async () => {
      const input = makeInput({ transactionId: 'tx-get' });
      const assessed = await svc.assess(input);
      const fetched = await svc.getDecision('tx-get');
      expect(fetched).toBe(assessed);
    });
  });

  // ─── getDeviceTrust ───────────────────────────────────────────────────────

  describe('getDeviceTrust', () => {
    it('returns null for unknown deviceId', async () => {
      const result = await svc.getDeviceTrust('ghost-device');
      expect(result).toBeNull();
    });

    it('returns device info after a transaction with that device', async () => {
      await svc.assess(makeInput({ transactionId: 'tx-dev', deviceId: 'dev-abc', userId: 'user-x' }));
      const trust = await svc.getDeviceTrust('dev-abc');

      expect(trust).not.toBeNull();
      expect(trust!.deviceId).toBe('dev-abc');
      expect(trust!.transactionCount).toBe(1);
      expect(trust!.knownUserIds).toContain('user-x');
      expect(trust!.firstSeen).toBeInstanceOf(Date);
      expect(trust!.lastSeen).toBeInstanceOf(Date);
    });

    it('transactionCount increments with each use', async () => {
      const deviceId = 'dev-count';
      const userId = 'user-count';

      await svc.assess(makeInput({ transactionId: 'tx-cnt-1', deviceId, userId }));
      await svc.assess(makeInput({ transactionId: 'tx-cnt-2', deviceId, userId }));

      const trust = await svc.getDeviceTrust(deviceId);
      expect(trust!.transactionCount).toBe(2);
    });

    it('knownUserIds grows when new users use the same device', async () => {
      const deviceId = 'dev-multi';
      await svc.assess(makeInput({ transactionId: 'tx-mu-1', deviceId, userId: 'user-1' }));
      await svc.assess(makeInput({ transactionId: 'tx-mu-2', deviceId, userId: 'user-2' }));

      const trust = await svc.getDeviceTrust(deviceId);
      expect(trust!.knownUserIds).toContain('user-1');
      expect(trust!.knownUserIds).toContain('user-2');
    });

    it('knownUserIds does not duplicate same userId', async () => {
      const deviceId = 'dev-dedup';
      const userId = 'user-dedup';

      await svc.assess(makeInput({ transactionId: 'tx-dd-1', deviceId, userId }));
      await svc.assess(makeInput({ transactionId: 'tx-dd-2', deviceId, userId }));

      const trust = await svc.getDeviceTrust(deviceId);
      const count = trust!.knownUserIds.filter(id => id === userId).length;
      expect(count).toBe(1);
    });

    it('trustScore grows with transaction count and is capped at 100', async () => {
      const deviceId = 'dev-trust';
      const userId = 'user-trust';

      for (let i = 0; i < 20; i++) {
        await svc.assess(makeInput({ transactionId: `tx-ts-${i}`, deviceId, userId }));
      }

      const trust = await svc.getDeviceTrust(deviceId);
      expect(trust!.trustScore).toBeLessThanOrEqual(100);
      expect(trust!.trustScore).toBeGreaterThan(0);
    });
  });
});
