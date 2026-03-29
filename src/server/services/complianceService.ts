/**
 * Compliance Service — AML screening, sanctions checks, and transaction limits.
 *
 * Enforces the compliance framework: screens transactions before processing,
 * checks names against sanctions lists, and enforces per-tier monthly limits.
 *
 * DefaultComplianceService is an in-memory sandbox implementation.
 * Swap with a database-backed + external API implementation for production.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Monthly transaction limits per KYC tier (USD). Tier 3 is unlimited. */
export const TIER_MONTHLY_LIMITS: Readonly<Record<number, number>> = {
  0: 0,
  1: 500,
  2: 3000,
  3: Infinity,
};

/**
 * Sandbox sanctions list — names containing these tokens are blocked.
 * In production, replace with Comply Advantage / OFAC SDN API calls.
 */
const SANCTIONS_BLOCKLIST: ReadonlyArray<string> = [
  'BLOCKED ENTITY TEST',
  'OFAC TEST ENTITY',
  'SDN TEST NAME',
];

/** Daily transaction count threshold that triggers AML velocity flag. */
const AML_DAILY_TX_THRESHOLD = 5;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ComplianceCheckType {
  AML       = 'aml',
  SANCTIONS = 'sanctions',
  LIMIT     = 'limit',
}

export enum ComplianceResult {
  Approved = 'approved',
  Blocked  = 'blocked',
  Flagged  = 'flagged',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComplianceCheckInput = {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  senderName: string;
  recipientName: string;
  corridorId?: string | null;
  kycTier: number;
};

export type SubCheckResult = {
  type: ComplianceCheckType;
  result: ComplianceResult;
  riskScore: number;
  detail?: string;
};

export type SanctionsHit = {
  listName: string;
  matchedEntry: string;
  matchedField: 'sender_name' | 'recipient_name';
};

export type ComplianceCheckResult = {
  checkId: string;
  transactionId: string;
  userId: string;
  result: ComplianceResult;
  riskScore: number;
  errorCode?: string;
  checks: SubCheckResult[];
  sanctionsHit?: SanctionsHit;
  checkedAt: Date;
};

export type StoredCheck = ComplianceCheckResult;

export type UserLimits = {
  userId: string;
  kycTier: number;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
};

export type TransactionFlag = {
  flagId: string;
  transactionId: string;
  reason: string;
  flaggedAt: Date;
  status: 'pending_review' | 'cleared' | 'confirmed_suspicious';
};

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IComplianceService {
  check(input: ComplianceCheckInput): Promise<ComplianceCheckResult>;
  getCheck(checkId: string): Promise<StoredCheck>;
  getLimits(userId: string, kycTier: number): Promise<UserLimits>;
  flagForReview(transactionId: string, reason: string): Promise<TransactionFlag>;
  recordUsage(userId: string, amount: number): Promise<void>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ComplianceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ComplianceError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateFlagId(): string {
  return `flg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isSanctioned(name: string): boolean {
  const upper = name.toUpperCase();
  return SANCTIONS_BLOCKLIST.some((blocked) => upper.includes(blocked.toUpperCase()));
}

// ─── Default (in-memory sandbox) implementation ───────────────────────────────

export class DefaultComplianceService implements IComplianceService {
  /** checkId → stored check result */
  private readonly checks = new Map<string, StoredCheck>();

  /** userId → total monthly usage in USD */
  private readonly monthlyUsage = new Map<string, number>();

  /** userId → daily transaction count (resets per process restart in sandbox) */
  private readonly dailyTxCount = new Map<string, number>();

  async check(input: ComplianceCheckInput): Promise<ComplianceCheckResult> {
    const { transactionId, userId, amount, senderName, recipientName, kycTier } = input;

    const subChecks: SubCheckResult[] = [];
    let overallResult = ComplianceResult.Approved;
    let errorCode: string | undefined;
    let sanctionsHit: SanctionsHit | undefined;

    // ── 1. Tier / KYC limit check ───────────────────────────────────────────
    const limitCheck = this._runLimitCheck(userId, amount, kycTier);
    subChecks.push(limitCheck);

    if (limitCheck.result === ComplianceResult.Blocked) {
      overallResult = ComplianceResult.Blocked;
      errorCode = kycTier === 0 ? 'TIER_LIMIT_EXCEEDED' : 'MONTHLY_LIMIT_EXCEEDED';
    }

    // ── 2. Sanctions check ─────────────────────────────────────────────────
    const sanctionsCheck = this._runSanctionsCheck(senderName, recipientName);
    subChecks.push(sanctionsCheck);

    if (sanctionsCheck.result === ComplianceResult.Blocked) {
      overallResult = ComplianceResult.Blocked;
      errorCode = errorCode ?? 'SANCTIONS_MATCH';

      const matchedField = isSanctioned(senderName) ? 'sender_name' : 'recipient_name';
      const matchedName = matchedField === 'sender_name' ? senderName : recipientName;
      sanctionsHit = {
        listName: 'OFAC_SDN',
        matchedEntry: matchedName,
        matchedField,
      };
    }

    // ── 3. AML velocity check ──────────────────────────────────────────────
    const amlCheck = this._runAmlCheck(userId, amount);
    subChecks.push(amlCheck);

    if (amlCheck.result === ComplianceResult.Blocked) {
      overallResult = ComplianceResult.Blocked;
      errorCode = errorCode ?? 'AML_VELOCITY_EXCEEDED';
    } else if (amlCheck.result === ComplianceResult.Flagged && overallResult === ComplianceResult.Approved) {
      overallResult = ComplianceResult.Flagged;
    }

    // ── Aggregate risk score ───────────────────────────────────────────────
    const riskScore = Math.min(100, Math.round(
      subChecks.reduce((sum, c) => sum + c.riskScore, 0) / subChecks.length,
    ));

    const result: ComplianceCheckResult = {
      checkId: generateId(),
      transactionId,
      userId,
      result: overallResult,
      riskScore,
      checks: subChecks,
      checkedAt: new Date(),
      ...(errorCode ? { errorCode } : {}),
      ...(sanctionsHit ? { sanctionsHit } : {}),
    };

    this.checks.set(result.checkId, result);

    // Increment daily tx counter for velocity tracking
    this.dailyTxCount.set(userId, (this.dailyTxCount.get(userId) ?? 0) + 1);

    return result;
  }

  async getCheck(checkId: string): Promise<StoredCheck> {
    const check = this.checks.get(checkId);
    if (!check) {
      throw new ComplianceError(`Compliance check not found: ${checkId}`, 'NOT_FOUND');
    }
    return check;
  }

  async getLimits(userId: string, kycTier: number): Promise<UserLimits> {
    const monthlyLimit = TIER_MONTHLY_LIMITS[kycTier] ?? 0;
    const monthlyUsed = this.monthlyUsage.get(userId) ?? 0;
    const monthlyRemaining = monthlyLimit === Infinity ? Infinity : Math.max(0, monthlyLimit - monthlyUsed);

    return {
      userId,
      kycTier,
      monthlyLimit,
      monthlyUsed,
      monthlyRemaining,
    };
  }

  async flagForReview(transactionId: string, reason: string): Promise<TransactionFlag> {
    return {
      flagId: generateFlagId(),
      transactionId,
      reason,
      flaggedAt: new Date(),
      status: 'pending_review',
    };
  }

  async recordUsage(userId: string, amount: number): Promise<void> {
    const current = this.monthlyUsage.get(userId) ?? 0;
    this.monthlyUsage.set(userId, current + amount);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _runLimitCheck(userId: string, amount: number, kycTier: number): SubCheckResult {
    if (kycTier === 0) {
      return {
        type: ComplianceCheckType.LIMIT,
        result: ComplianceResult.Blocked,
        riskScore: 100,
        detail: 'KYC not completed — all transactions blocked',
      };
    }

    if (kycTier === 3) {
      return {
        type: ComplianceCheckType.LIMIT,
        result: ComplianceResult.Approved,
        riskScore: 0,
        detail: 'Tier 3: unlimited',
      };
    }

    const monthlyLimit = TIER_MONTHLY_LIMITS[kycTier] ?? 0;
    const used = this.monthlyUsage.get(userId) ?? 0;
    const projectedTotal = used + amount;

    if (projectedTotal > monthlyLimit) {
      return {
        type: ComplianceCheckType.LIMIT,
        result: ComplianceResult.Blocked,
        riskScore: 90,
        detail: `Monthly limit $${monthlyLimit} exceeded: used $${used} + $${amount} = $${projectedTotal}`,
      };
    }

    // Warn when approaching limit (>80% used)
    const utilizationAfter = projectedTotal / monthlyLimit;
    const riskScore = Math.round(utilizationAfter * 40); // max 40 for limit check
    return {
      type: ComplianceCheckType.LIMIT,
      result: ComplianceResult.Approved,
      riskScore,
      detail: `$${projectedTotal} of $${monthlyLimit} monthly limit`,
    };
  }

  private _runSanctionsCheck(senderName: string, recipientName: string): SubCheckResult {
    if (isSanctioned(senderName) || isSanctioned(recipientName)) {
      return {
        type: ComplianceCheckType.SANCTIONS,
        result: ComplianceResult.Blocked,
        riskScore: 100,
        detail: 'Sanctions match found — transaction blocked',
      };
    }

    return {
      type: ComplianceCheckType.SANCTIONS,
      result: ComplianceResult.Approved,
      riskScore: 0,
      detail: 'No sanctions matches found',
    };
  }

  private _runAmlCheck(userId: string, amount: number): SubCheckResult {
    const dailyCount = this.dailyTxCount.get(userId) ?? 0;

    // Structuring detection: many small transactions
    if (dailyCount >= AML_DAILY_TX_THRESHOLD) {
      return {
        type: ComplianceCheckType.AML,
        result: ComplianceResult.Flagged,
        riskScore: 70,
        detail: `High velocity: ${dailyCount + 1} transactions in current day window`,
      };
    }

    // Unusual large amount detection
    if (amount > 2000) {
      return {
        type: ComplianceCheckType.AML,
        result: ComplianceResult.Flagged,
        riskScore: 50,
        detail: `Large transaction amount: $${amount}`,
      };
    }

    return {
      type: ComplianceCheckType.AML,
      result: ComplianceResult.Approved,
      riskScore: 5,
      detail: 'No AML triggers',
    };
  }
}
