/**
 * Fraud Detection Service — velocity checks, device fingerprinting,
 * behavioral anomaly detection, risk scoring, and automated actions.
 *
 * Layered on top of the Compliance Service, this engine provides a second
 * line of defence against fraudulent transactions.
 *
 * DefaultFraudDetectionService is an in-memory sandbox implementation.
 * Swap with a database-backed implementation for production.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Risk score thresholds that determine automated action. */
export const RISK_THRESHOLDS: Readonly<{ low: number; medium: number; high: number }> = {
  low: 25,
  medium: 50,
  high: 75,
};

/** Velocity windows — maximum transactions allowed within the window. */
const VELOCITY_LIMITS = {
  userPerHour: 10,
  ipPerHour: 10,
  corridorPerDay: 8,
} as const;

/** Off-hours window (local hour, 0–23) that attracts behavioral risk. */
const OFF_HOURS_START = 23;
const OFF_HOURS_END = 6;

/** Amount threshold (USD) that triggers large-transaction behavioral signal. */
const LARGE_AMOUNT_THRESHOLD = 2000;

/** Number of prior transactions with a device before it is considered "trusted". */
const DEVICE_TRUST_THRESHOLD = 3;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum FraudCheckType {
  Velocity   = 'velocity',
  Device     = 'device',
  Behavioral = 'behavioral',
}

export enum FraudAction {
  Approve = 'approve',
  Flag    = 'flag',
  Block   = 'block',
  Review  = 'review',
}

export enum FraudRiskLevel {
  Low      = 'low',
  Medium   = 'medium',
  High     = 'high',
  Critical = 'critical',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FraudAssessmentInput = {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  recipientId?: string | null;
  corridorId?: string | null;
  deviceId: string;
  ipAddress: string;
  userAgent?: string | null;
  /** Local hour (0–23) at time of transaction — used for off-hours detection. */
  hour: number;
};

export type FraudSubCheck = {
  type: FraudCheckType;
  riskScore: number;
  detail: string;
};

export type FraudAssessmentResult = {
  assessmentId: string;
  transactionId: string;
  userId: string;
  riskScore: number;
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  checks: FraudSubCheck[];
  reasonCodes: string[];
  decidedAt: Date;
};

export type DeviceTrustInfo = {
  deviceId: string;
  trustScore: number;
  firstSeen: Date;
  lastSeen: Date;
  transactionCount: number;
  knownUserIds: string[];
};

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IFraudDetectionService {
  assess(input: FraudAssessmentInput): Promise<FraudAssessmentResult>;
  getDecision(transactionId: string): Promise<FraudAssessmentResult | null>;
  getDeviceTrust(deviceId: string): Promise<DeviceTrustInfo | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toRiskLevel(score: number): FraudRiskLevel {
  if (score < RISK_THRESHOLDS.low) return FraudRiskLevel.Low;
  if (score < RISK_THRESHOLDS.medium) return FraudRiskLevel.Medium;
  if (score < RISK_THRESHOLDS.high) return FraudRiskLevel.High;
  return FraudRiskLevel.Critical;
}

function toAction(score: number): FraudAction {
  if (score >= RISK_THRESHOLDS.high) return FraudAction.Block;
  if (score >= RISK_THRESHOLDS.medium) return FraudAction.Flag;
  if (score >= RISK_THRESHOLDS.low) return FraudAction.Review;
  return FraudAction.Approve;
}

function isOffHours(hour: number): boolean {
  return hour >= OFF_HOURS_START || hour <= OFF_HOURS_END;
}

function bucketKey(prefix: string, id: string, window: 'hour' | 'day'): string {
  const now = new Date();
  if (window === 'hour') {
    return `${prefix}:${id}:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  }
  return `${prefix}:${id}:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
}

// ─── In-memory sandbox implementation ────────────────────────────────────────

export class DefaultFraudDetectionService implements IFraudDetectionService {
  /** transactionId → assessment result (audit log) */
  private readonly decisions = new Map<string, FraudAssessmentResult>();

  /** deviceId → DeviceTrustInfo */
  private readonly devices = new Map<string, DeviceTrustInfo>();

  /** velocity bucket key → count */
  private readonly velocityCounters = new Map<string, number>();

  /** userId → set of known recipientIds */
  private readonly knownRecipients = new Map<string, Set<string>>();

  async assess(input: FraudAssessmentInput): Promise<FraudAssessmentResult> {
    // Idempotency: return stored result if same transactionId already assessed
    const existing = this.decisions.get(input.transactionId);
    if (existing) return existing;

    const checks: FraudSubCheck[] = [
      this._runVelocityCheck(input),
      this._runDeviceCheck(input),
      this._runBehavioralCheck(input),
    ];

    // Use the maximum sub-check score: one strong signal is enough to trigger action
    const riskScore = Math.min(100, Math.max(...checks.map(c => c.riskScore)));

    const riskLevel = toRiskLevel(riskScore);
    const action = toAction(riskScore);

    const reasonCodes = checks
      .filter(c => c.riskScore >= RISK_THRESHOLDS.low)
      .map(c => `${c.type.toUpperCase()}_RISK`);

    const result: FraudAssessmentResult = {
      assessmentId: generateId('frd'),
      transactionId: input.transactionId,
      userId: input.userId,
      riskScore,
      riskLevel,
      action,
      checks,
      reasonCodes,
      decidedAt: new Date(),
    };

    // Persist to audit log
    this.decisions.set(input.transactionId, result);

    // Update device trust
    this._updateDeviceTrust(input.deviceId, input.userId);

    // Update velocity counters (after assessment to not count current tx in its own check)
    this._incrementVelocityCounters(input);

    // Record recipient as known for this user
    if (input.recipientId) {
      const known = this.knownRecipients.get(input.userId) ?? new Set();
      known.add(input.recipientId);
      this.knownRecipients.set(input.userId, known);
    }

    return result;
  }

  async getDecision(transactionId: string): Promise<FraudAssessmentResult | null> {
    return this.decisions.get(transactionId) ?? null;
  }

  async getDeviceTrust(deviceId: string): Promise<DeviceTrustInfo | null> {
    return this.devices.get(deviceId) ?? null;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _runVelocityCheck(input: FraudAssessmentInput): FraudSubCheck {
    const userKey = bucketKey('user', input.userId, 'hour');
    const ipKey = bucketKey('ip', input.ipAddress, 'hour');
    const corridorKey = input.corridorId
      ? bucketKey('corridor', `${input.userId}:${input.corridorId}`, 'day')
      : null;

    const userCount = this.velocityCounters.get(userKey) ?? 0;
    const ipCount = this.velocityCounters.get(ipKey) ?? 0;
    const corridorCount = corridorKey ? (this.velocityCounters.get(corridorKey) ?? 0) : 0;

    const signals: string[] = [];
    let riskScore = 0;

    if (userCount >= VELOCITY_LIMITS.userPerHour) {
      riskScore = Math.max(riskScore, 80);
      signals.push(`user velocity: ${userCount + 1} tx/hour (limit: ${VELOCITY_LIMITS.userPerHour})`);
    } else if (userCount >= VELOCITY_LIMITS.userPerHour * 0.7) {
      riskScore = Math.max(riskScore, 40);
      signals.push(`user velocity approaching limit: ${userCount + 1} tx/hour`);
    }

    if (ipCount >= VELOCITY_LIMITS.ipPerHour) {
      riskScore = Math.max(riskScore, 75);
      signals.push(`IP velocity: ${ipCount + 1} tx/hour from ${input.ipAddress}`);
    } else if (ipCount >= VELOCITY_LIMITS.ipPerHour * 0.7) {
      riskScore = Math.max(riskScore, 35);
      signals.push(`IP velocity approaching limit: ${ipCount + 1} tx/hour`);
    }

    if (corridorCount >= VELOCITY_LIMITS.corridorPerDay) {
      riskScore = Math.max(riskScore, 70);
      signals.push(`corridor velocity: ${corridorCount + 1} tx/day on ${input.corridorId}`);
    }

    return {
      type: FraudCheckType.Velocity,
      riskScore,
      detail: signals.length > 0 ? signals.join('; ') : 'Within normal velocity limits',
    };
  }

  private _runDeviceCheck(input: FraudAssessmentInput): FraudSubCheck {
    const device = this.devices.get(input.deviceId);

    if (!device) {
      return {
        type: FraudCheckType.Device,
        riskScore: 20,
        detail: 'New/unknown device — no prior transaction history',
      };
    }

    const isTrusted = device.transactionCount >= DEVICE_TRUST_THRESHOLD;
    const isUserMismatch = !device.knownUserIds.includes(input.userId);

    if (isUserMismatch) {
      return {
        type: FraudCheckType.Device,
        riskScore: 60,
        detail: `Device ${input.deviceId} used by ${device.knownUserIds.length} other user(s)`,
      };
    }

    if (isTrusted) {
      return {
        type: FraudCheckType.Device,
        riskScore: 5,
        detail: `Known trusted device (${device.transactionCount} prior transactions)`,
      };
    }

    return {
      type: FraudCheckType.Device,
      riskScore: 15,
      detail: `Familiar device (${device.transactionCount} prior transactions, not yet trusted)`,
    };
  }

  private _runBehavioralCheck(input: FraudAssessmentInput): FraudSubCheck {
    const signals: string[] = [];
    let riskScore = 0;

    // Off-hours detection
    if (isOffHours(input.hour)) {
      riskScore = Math.max(riskScore, 30);
      signals.push(`off-hours transaction at hour ${input.hour}`);
    }

    // Large amount detection
    if (input.amount > LARGE_AMOUNT_THRESHOLD) {
      riskScore = Math.max(riskScore, 40);
      signals.push(`large amount: ${input.currency} ${input.amount}`);
    } else if (input.amount > LARGE_AMOUNT_THRESHOLD * 0.5) {
      riskScore = Math.max(riskScore, 15);
      signals.push(`elevated amount: ${input.currency} ${input.amount}`);
    }

    // New recipient detection
    if (input.recipientId) {
      const knownRecipients = this.knownRecipients.get(input.userId);
      if (!knownRecipients || !knownRecipients.has(input.recipientId)) {
        riskScore = Math.max(riskScore, 15);
        signals.push(`new/unknown recipient: ${input.recipientId}`);
      }
    }

    return {
      type: FraudCheckType.Behavioral,
      riskScore,
      detail: signals.length > 0 ? signals.join('; ') : 'No behavioral anomalies detected',
    };
  }

  private _updateDeviceTrust(deviceId: string, userId: string): void {
    const existing = this.devices.get(deviceId);
    const now = new Date();

    if (!existing) {
      this.devices.set(deviceId, {
        deviceId,
        trustScore: 10,
        firstSeen: now,
        lastSeen: now,
        transactionCount: 1,
        knownUserIds: [userId],
      });
      return;
    }

    const knownUserIds = existing.knownUserIds.includes(userId)
      ? existing.knownUserIds
      : [...existing.knownUserIds, userId];

    const transactionCount = existing.transactionCount + 1;
    // Trust score grows with transaction count, capped at 100
    const trustScore = Math.min(100, Math.round((transactionCount / DEVICE_TRUST_THRESHOLD) * 50));

    this.devices.set(deviceId, {
      ...existing,
      trustScore,
      lastSeen: now,
      transactionCount,
      knownUserIds,
    });
  }

  private _incrementVelocityCounters(input: FraudAssessmentInput): void {
    const userKey = bucketKey('user', input.userId, 'hour');
    const ipKey = bucketKey('ip', input.ipAddress, 'hour');

    this.velocityCounters.set(userKey, (this.velocityCounters.get(userKey) ?? 0) + 1);
    this.velocityCounters.set(ipKey, (this.velocityCounters.get(ipKey) ?? 0) + 1);

    if (input.corridorId) {
      const corridorKey = bucketKey('corridor', `${input.userId}:${input.corridorId}`, 'day');
      this.velocityCounters.set(corridorKey, (this.velocityCounters.get(corridorKey) ?? 0) + 1);
    }
  }
}
