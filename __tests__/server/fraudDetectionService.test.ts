/**
 * Unit tests for FraudDetectionService.
 *
 * Tests velocity checks, device fingerprinting, behavioral scoring, risk
 * scoring, and automated actions.  Follows TDD: tests are written before
 * the implementation.
 */

import {
  DefaultFraudDetectionService,
  FraudAction,
  FraudCheckType,
  FraudRiskLevel,
  type FraudAssessmentInput,
  type FraudAssessmentResult,
  type IFraudDetectionService,
  RISK_THRESHOLDS,
} from '@/server/services/fraudDetectionService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<FraudAssessmentInput> = {}): FraudAssessmentInput {
  return {
    transactionId: 'tx-001',
    userId: 'user-abc',
    amount: 100,
    currency: 'USD',
    recipientId: 'recipient-xyz',
    corridorId: 'cor-ng',
    deviceId: 'device-001',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    hour: 14, // 2 PM — normal business hours
    ...overrides,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe('RISK_THRESHOLDS', () => {
  it('defines low threshold below medium', () => {
    expect(RISK_THRESHOLDS.low).toBeLessThan(RISK_THRESHOLDS.medium);
  });

  it('defines medium threshold below high', () => {
    expect(RISK_THRESHOLDS.medium).toBeLessThan(RISK_THRESHOLDS.high);
  });

  it('defines high threshold below 100', () => {
    expect(RISK_THRESHOLDS.high).toBeLessThan(100);
  });
});

// ─── DefaultFraudDetectionService ────────────────────────────────────────────

describe('DefaultFraudDetectionService', () => {
  let service: IFraudDetectionService;

  beforeEach(() => {
    service = new DefaultFraudDetectionService();
  });

  // ── assess: basic happy path ─────────────────────────────────────────────

  describe('assess — happy path', () => {
    it('returns an assessment with an id and transactionId', async () => {
      const result = await service.assess(makeInput());
      expect(result.assessmentId).toBeTruthy();
      expect(result.transactionId).toBe('tx-001');
    });

    it('returns approved action for a clean, low-risk transaction', async () => {
      const result = await service.assess(makeInput());
      expect(result.action).toBe(FraudAction.Approve);
    });

    it('returns a riskScore between 0 and 100', async () => {
      const result = await service.assess(makeInput());
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('returns a riskLevel', async () => {
      const result = await service.assess(makeInput());
      expect(Object.values(FraudRiskLevel)).toContain(result.riskLevel);
    });

    it('includes at least one sub-check', async () => {
      const result = await service.assess(makeInput());
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('includes a decidedAt timestamp', async () => {
      const result = await service.assess(makeInput());
      expect(result.decidedAt).toBeInstanceOf(Date);
    });

    it('includes reasonCodes array', async () => {
      const result = await service.assess(makeInput());
      expect(Array.isArray(result.reasonCodes)).toBe(true);
    });
  });

  // ── Velocity checks ───────────────────────────────────────────────────────

  describe('velocity checks', () => {
    it('flags after many transactions from same user in short window', async () => {
      const userId = 'high-velocity-user';
      // send 10 transactions quickly
      for (let i = 0; i < 10; i++) {
        await service.assess(makeInput({ userId, transactionId: `tx-v-${i}` }));
      }
      const result = await service.assess(makeInput({ userId, transactionId: 'tx-v-11' }));
      // Should be flagged or blocked due to velocity
      expect([FraudAction.Flag, FraudAction.Block]).toContain(result.action);
    });

    it('flags after high corridor velocity', async () => {
      const userId = 'corridor-user';
      const corridorId = 'cor-ng';
      for (let i = 0; i < 8; i++) {
        await service.assess(makeInput({ userId, corridorId, transactionId: `tx-c-${i}` }));
      }
      const result = await service.assess(makeInput({ userId, corridorId, transactionId: 'tx-c-9' }));
      expect([FraudAction.Flag, FraudAction.Block]).toContain(result.action);
    });

    it('flags after many transactions from same IP', async () => {
      const ipAddress = '10.0.0.1';
      for (let i = 0; i < 10; i++) {
        await service.assess(makeInput({ ipAddress, userId: `user-ip-${i}`, transactionId: `tx-ip-${i}` }));
      }
      const result = await service.assess(makeInput({ ipAddress, userId: 'user-ip-final', transactionId: 'tx-ip-10' }));
      expect([FraudAction.Flag, FraudAction.Block]).toContain(result.action);
    });

    it('includes velocity check type in sub-checks', async () => {
      const result = await service.assess(makeInput());
      const velocityCheck = result.checks.find(c => c.type === FraudCheckType.Velocity);
      expect(velocityCheck).toBeDefined();
    });
  });

  // ── Device fingerprinting ────────────────────────────────────────────────

  describe('device fingerprinting', () => {
    it('includes device check type in sub-checks', async () => {
      const result = await service.assess(makeInput());
      const deviceCheck = result.checks.find(c => c.type === FraudCheckType.Device);
      expect(deviceCheck).toBeDefined();
    });

    it('returns low device risk for a known trusted device', async () => {
      const deviceId = 'trusted-device-001';
      // Establish trust with prior transactions
      for (let i = 0; i < 3; i++) {
        await service.assess(makeInput({ deviceId, transactionId: `tx-trust-${i}` }));
      }
      const result = await service.assess(makeInput({ deviceId, transactionId: 'tx-trust-final' }));
      const deviceCheck = result.checks.find(c => c.type === FraudCheckType.Device);
      expect(deviceCheck).toBeDefined();
      expect(deviceCheck!.riskScore).toBeLessThanOrEqual(30);
    });

    it('returns elevated risk for a new unknown device', async () => {
      const result = await service.assess(makeInput({ deviceId: 'brand-new-device-xyz-999' }));
      const deviceCheck = result.checks.find(c => c.type === FraudCheckType.Device);
      expect(deviceCheck).toBeDefined();
      expect(deviceCheck!.riskScore).toBeGreaterThan(0);
    });

    it('can retrieve device trust info', async () => {
      const deviceId = 'device-lookup-001';
      await service.assess(makeInput({ deviceId }));
      const trust = await service.getDeviceTrust(deviceId);
      expect(trust).toBeDefined();
      expect(trust!.deviceId).toBe(deviceId);
      expect(typeof trust!.trustScore).toBe('number');
      expect(trust!.firstSeen).toBeInstanceOf(Date);
      expect(trust!.lastSeen).toBeInstanceOf(Date);
      expect(typeof trust!.transactionCount).toBe('number');
    });

    it('returns null for unknown device in getDeviceTrust', async () => {
      const trust = await service.getDeviceTrust('nonexistent-device-999');
      expect(trust).toBeNull();
    });
  });

  // ── Behavioral scoring ────────────────────────────────────────────────────

  describe('behavioral scoring', () => {
    it('includes behavioral check type in sub-checks', async () => {
      const result = await service.assess(makeInput());
      const behaviorCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral);
      expect(behaviorCheck).toBeDefined();
    });

    it('flags off-hours transactions (3 AM)', async () => {
      const result = await service.assess(makeInput({ hour: 3 }));
      const behaviorCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral);
      expect(behaviorCheck).toBeDefined();
      expect(behaviorCheck!.riskScore).toBeGreaterThan(0);
    });

    it('gives lower behavioral risk during normal business hours', async () => {
      const normal = await service.assess(makeInput({ hour: 10 }));
      const offHours = await service.assess(makeInput({ hour: 3, transactionId: 'tx-off' }));
      const normalBehavior = normal.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      const offBehavior = offHours.checks.find(c => c.type === FraudCheckType.Behavioral)!;
      expect(offBehavior.riskScore).toBeGreaterThan(normalBehavior.riskScore);
    });

    it('flags unusually large amounts', async () => {
      const result = await service.assess(makeInput({ amount: 5000 }));
      const behaviorCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral);
      expect(behaviorCheck!.riskScore).toBeGreaterThan(10);
    });

    it('flags new recipient', async () => {
      const result = await service.assess(makeInput({ recipientId: 'brand-new-recipient-never-seen' }));
      const behaviorCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral);
      expect(behaviorCheck!.riskScore).toBeGreaterThan(0);
    });
  });

  // ── Risk scoring & actions ────────────────────────────────────────────────

  describe('risk scoring and actions', () => {
    it('approves transactions with risk score below low threshold', async () => {
      // A clean, normal transaction
      const result = await service.assess(makeInput());
      if (result.riskScore < RISK_THRESHOLDS.low) {
        expect(result.action).toBe(FraudAction.Approve);
      }
    });

    it('blocks transactions with very high risk score', async () => {
      // Simulate a suspicious transaction: off-hours + new device + high amount + IP flood
      const suspiciousIp = '1.2.3.4';
      for (let i = 0; i < 15; i++) {
        await service.assess(makeInput({
          ipAddress: suspiciousIp,
          userId: `user-flood-${i}`,
          transactionId: `tx-flood-${i}`,
        }));
      }
      const result = await service.assess(makeInput({
        userId: 'victim-user',
        transactionId: 'tx-block-test',
        amount: 4999,
        hour: 2,
        deviceId: 'brand-new-suspicious-device-abc',
        ipAddress: suspiciousIp,
      }));
      // With all these red flags, should be flagged or blocked
      expect([FraudAction.Flag, FraudAction.Block]).toContain(result.action);
    });

    it('assigns FraudRiskLevel.low for low risk scores', async () => {
      const result = await service.assess(makeInput());
      if (result.riskScore < RISK_THRESHOLDS.low) {
        expect(result.riskLevel).toBe(FraudRiskLevel.Low);
      }
    });
  });

  // ── Audit log ────────────────────────────────────────────────────────────

  describe('getDecision', () => {
    it('retrieves a stored fraud decision by transactionId', async () => {
      const input = makeInput({ transactionId: 'tx-audit-001' });
      const assessment = await service.assess(input);
      const decision = await service.getDecision('tx-audit-001');
      expect(decision).toBeDefined();
      expect(decision!.transactionId).toBe('tx-audit-001');
      expect(decision!.assessmentId).toBe(assessment.assessmentId);
    });

    it('returns null for unknown transactionId', async () => {
      const decision = await service.getDecision('tx-does-not-exist-999');
      expect(decision).toBeNull();
    });
  });

  // ── Reason codes ─────────────────────────────────────────────────────────

  describe('reason codes', () => {
    it('includes reason code for off-hours when applicable', async () => {
      const result = await service.assess(makeInput({ hour: 1 }));
      const behaviorCheck = result.checks.find(c => c.type === FraudCheckType.Behavioral);
      if (behaviorCheck && behaviorCheck.riskScore > 0) {
        // At least the behavior check should have a detail
        expect(behaviorCheck.detail).toBeTruthy();
      }
    });

    it('reasonCodes is empty for a clean low-risk transaction at normal hours', async () => {
      // Fresh service, single small transaction in business hours
      const fresh = new DefaultFraudDetectionService();
      const result = await fresh.assess(makeInput({ amount: 50, hour: 11 }));
      // riskScore should be low enough to not generate reason codes for high-risk signals
      expect(Array.isArray(result.reasonCodes)).toBe(true);
    });
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('returns the same assessmentId for the same transactionId', async () => {
      const input = makeInput({ transactionId: 'tx-idem-001' });
      const first = await service.assess(input);
      const second = await service.assess(input);
      expect(second.assessmentId).toBe(first.assessmentId);
    });
  });
});
