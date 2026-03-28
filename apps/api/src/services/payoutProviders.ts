/**
 * Sandbox payout provider implementations.
 *
 * In production, replace these with live API adapters for each provider.
 * Provider names must match the ROUTING_TABLE in payoutRoutingService.ts.
 */

import type {
  IPayoutProvider,
  PayoutMethod,
  PayoutRequest,
  PayoutResult,
} from './payoutRoutingService';

function generateRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── M-Pesa sandbox (KE, TZ) ─────────────────────────────────────────────────

export class SandboxMpesaProvider implements IPayoutProvider {
  readonly name = 'mpesa';
  readonly supportedCountries: ReadonlyArray<string> = ['KE', 'TZ'];
  readonly supportedMethods: ReadonlyArray<PayoutMethod> = ['mobile_money'];

  async initiatePayout(request: PayoutRequest): Promise<PayoutResult> {
    const ref = generateRef('mpesa');
    return {
      providerRef: ref,
      status: 'pending',
      provider: this.name,
      raw: {
        sandbox: true,
        country: request.destinationCountry,
        phone: request.recipient.phoneNumber,
        amount: request.amount,
        currency: request.currency,
      },
    };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutResult> {
    return {
      providerRef,
      status: 'completed',
      provider: this.name,
      raw: { sandbox: true },
    };
  }
}

// ─── MTN MoMo sandbox (GH, UG, RW) ───────────────────────────────────────────

export class SandboxMtnMomoProvider implements IPayoutProvider {
  readonly name = 'mtn_momo';
  readonly supportedCountries: ReadonlyArray<string> = ['GH', 'UG', 'RW'];
  readonly supportedMethods: ReadonlyArray<PayoutMethod> = ['mobile_money'];

  async initiatePayout(request: PayoutRequest): Promise<PayoutResult> {
    const ref = generateRef('momo');
    return {
      providerRef: ref,
      status: 'pending',
      provider: this.name,
      raw: {
        sandbox: true,
        country: request.destinationCountry,
        phone: request.recipient.phoneNumber,
        amount: request.amount,
        currency: request.currency,
      },
    };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutResult> {
    return {
      providerRef,
      status: 'completed',
      provider: this.name,
      raw: { sandbox: true },
    };
  }
}

// ─── Airtel Money sandbox (UG, TZ, KE) ───────────────────────────────────────

export class SandboxAirtelMoneyProvider implements IPayoutProvider {
  readonly name = 'airtel_money';
  readonly supportedCountries: ReadonlyArray<string> = ['UG', 'TZ', 'KE'];
  readonly supportedMethods: ReadonlyArray<PayoutMethod> = ['mobile_money'];

  async initiatePayout(request: PayoutRequest): Promise<PayoutResult> {
    const ref = generateRef('airtel');
    return {
      providerRef: ref,
      status: 'pending',
      provider: this.name,
      raw: {
        sandbox: true,
        country: request.destinationCountry,
        phone: request.recipient.phoneNumber,
        amount: request.amount,
        currency: request.currency,
      },
    };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutResult> {
    return {
      providerRef,
      status: 'completed',
      provider: this.name,
      raw: { sandbox: true },
    };
  }
}

// ─── Orange Money sandbox (SN, CI, CM) ───────────────────────────────────────

export class SandboxOrangeMoneyProvider implements IPayoutProvider {
  readonly name = 'orange_money';
  readonly supportedCountries: ReadonlyArray<string> = ['SN', 'CI', 'CM'];
  readonly supportedMethods: ReadonlyArray<PayoutMethod> = ['mobile_money'];

  async initiatePayout(request: PayoutRequest): Promise<PayoutResult> {
    const ref = generateRef('orange');
    return {
      providerRef: ref,
      status: 'pending',
      provider: this.name,
      raw: {
        sandbox: true,
        country: request.destinationCountry,
        phone: request.recipient.phoneNumber,
        amount: request.amount,
        currency: request.currency,
      },
    };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutResult> {
    return {
      providerRef,
      status: 'completed',
      provider: this.name,
      raw: { sandbox: true },
    };
  }
}

// ─── Flutterwave bank transfer sandbox (NG, GH, KE) ──────────────────────────

export class SandboxFlutterwavePayoutProvider implements IPayoutProvider {
  readonly name = 'flutterwave';
  readonly supportedCountries: ReadonlyArray<string> = ['NG', 'GH', 'KE'];
  readonly supportedMethods: ReadonlyArray<PayoutMethod> = ['bank_transfer'];

  async initiatePayout(request: PayoutRequest): Promise<PayoutResult> {
    const ref = generateRef('fw');
    return {
      providerRef: ref,
      status: 'pending',
      provider: this.name,
      raw: {
        sandbox: true,
        country: request.destinationCountry,
        accountNumber: request.recipient.accountNumber,
        bankCode: request.recipient.bankCode,
        amount: request.amount,
        currency: request.currency,
      },
    };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutResult> {
    return {
      providerRef,
      status: 'completed',
      provider: this.name,
      raw: { sandbox: true },
    };
  }
}
