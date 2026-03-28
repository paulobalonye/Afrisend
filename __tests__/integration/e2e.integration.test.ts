/**
 * E2E Critical Flow Integration Tests
 *
 * Tests three end-to-end flows that span multiple adapters/utilities:
 *
 *   1. Webhook Security — Flutterwave + YellowCard + Veriff webhook validation
 *   2. OTP Delivery with Fallback — SMS → Email orchestration
 *   3. Flutterwave Send Money (sandbox) — account verify → transfer → status poll
 *
 * All live sandbox tests skip when credentials are absent (CI-safe).
 * The webhook and orchestration tests run without any credentials.
 */

import crypto from 'crypto';
import { verifyWebhookSignature as flutterwaveVerify, parseWebhookEvent } from '@/services/flutterwave/webhook';
import { verifyWebhookSignature as yellowcardVerify } from '@/services/yellowcard/webhookVerification';
import { verifyWebhookSignature as veriffVerify, parseWebhookPayload } from '@/services/veriff/webhookVerification';
import { OtpOrchestrator } from '@/services/otp/otpOrchestrator';
import { SmsOtpAdapter } from '@/services/otp/smsOtpAdapter';
import { EmailOtpAdapter } from '@/services/otp/emailOtpAdapter';
import { ApiError } from '@/api/client';
import { createFlutterwaveAdapter } from '@/services/flutterwave/adapter';

const HAS_FLW = Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
const itLive = HAS_FLW ? it : it.skip;

// ---------------------------------------------------------------------------
// Flow 1: Webhook Security across all three providers
// ---------------------------------------------------------------------------
describe('E2E Flow: Webhook Security — All Providers', () => {
  const WEBHOOK_HASH = 'flutterwave-test-secret';
  const YC_SECRET = 'yellowcard-test-secret-xyz';
  const VERIFF_SECRET = 'veriff-shared-secret-abc';

  const flwPayload = JSON.stringify({
    event: 'transfer.completed',
    data: { id: 1, tx_ref: 'ref-abc', status: 'SUCCESSFUL', amount: 5000, currency: 'NGN' },
  });

  const ycPayload = JSON.stringify({
    event: 'payment.completed',
    data: { id: 'pay_123', status: 'completed' },
  });

  const veriffPayload = JSON.stringify({
    id: 'evt-1',
    attemptId: 'att-1',
    feature: 'selfid',
    code: 9001,
    action: 'submitted',
    vendorData: 'user-ref',
    status: 'approved',
    verification: {
      id: 'ver-1',
      status: 'approved',
      code: 9001,
      reason: null,
      reasonCode: null,
      document: { type: 'PASSPORT', country: 'NG', number: null, validUntil: null },
      person: { firstName: null, lastName: null, dateOfBirth: null },
      riskLabels: [],
      checkedAt: '2026-03-28T10:00:00Z',
    },
  });

  it('all three providers: accept correctly signed payloads', () => {
    const ycSig = crypto.createHmac('sha256', YC_SECRET).update(ycPayload).digest('hex');
    const veriffSig = crypto.createHmac('sha256', VERIFF_SECRET).update(veriffPayload).digest('hex');

    // Flutterwave uses direct hash comparison (not HMAC)
    expect(flutterwaveVerify(WEBHOOK_HASH, WEBHOOK_HASH)).toBe(true);
    // YellowCard and Veriff use HMAC-SHA256
    expect(yellowcardVerify(ycPayload, ycSig, YC_SECRET)).toBe(true);
    expect(veriffVerify(veriffPayload, veriffSig, VERIFF_SECRET)).toBe(true);
  });

  it('all three providers: reject tampered payloads', () => {
    const tampered = '{"event":"fake","data":{}}';

    // Flutterwave: header mismatch
    expect(flutterwaveVerify('WRONG_HASH', WEBHOOK_HASH)).toBe(false);

    // YellowCard: signature from original doesn't match tampered
    const ycSig = crypto.createHmac('sha256', YC_SECRET).update(ycPayload).digest('hex');
    expect(yellowcardVerify(tampered, ycSig, YC_SECRET)).toBe(false);

    // Veriff: signature from original doesn't match tampered
    const veriffSig = crypto.createHmac('sha256', VERIFF_SECRET).update(veriffPayload).digest('hex');
    expect(veriffVerify(tampered, veriffSig, VERIFF_SECRET)).toBe(false);
  });

  it('all three providers: reject empty signatures', () => {
    expect(flutterwaveVerify('', WEBHOOK_HASH)).toBe(false);
    expect(yellowcardVerify(ycPayload, '', YC_SECRET)).toBe(false);
    expect(veriffVerify(veriffPayload, '', VERIFF_SECRET)).toBe(false);
  });

  it('Veriff parsed event strips PII while others pass through', () => {
    const veriffSig = crypto.createHmac('sha256', VERIFF_SECRET).update(veriffPayload).digest('hex');
    expect(veriffVerify(veriffPayload, veriffSig, VERIFF_SECRET)).toBe(true);

    const parsed = parseWebhookPayload(veriffPayload);
    const serialised = JSON.stringify(parsed);

    // Veriff webhook parsing strips PII
    expect(serialised).not.toContain('firstName');
    expect(serialised).not.toContain('lastName');
    expect(serialised).not.toContain('dateOfBirth');

    // Flutterwave webhook parsing preserves full data (no PII in payment events)
    const flwParsed = parseWebhookEvent(flwPayload);
    expect(flwParsed.event).toBe('transfer.completed');
    expect(flwParsed.data.tx_ref).toBe('ref-abc');
  });
});

// ---------------------------------------------------------------------------
// Flow 2: OTP Delivery with SMS → Email Fallback
// ---------------------------------------------------------------------------
describe('E2E Flow: OTP Delivery (SMS with email fallback)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('full happy path: SMS delivers successfully', async () => {
    const sms = new SmsOtpAdapter();
    const email = new EmailOtpAdapter();

    jest.spyOn(sms, 'sendSmsOtp').mockResolvedValue({
      sessionId: 'e2e-sms-1',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      channel: 'sms',
    });

    const orchestrator = new OtpOrchestrator(sms, email);
    const session = await orchestrator.sendOtp('+2348012345678', 'NG');

    expect(session.channel).toBe('sms');
    expect(session.sessionId).toBe('e2e-sms-1');
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('full fallback path: SMS fails (503) → email succeeds', async () => {
    const sms = new SmsOtpAdapter();
    const email = new EmailOtpAdapter();

    jest.spyOn(sms, 'sendSmsOtp').mockRejectedValue(
      new ApiError(503, 'Twilio unavailable', 'TWILIO_ERROR'),
    );
    jest.spyOn(email, 'sendEmailOtp').mockResolvedValue({
      sessionId: 'e2e-email-fallback',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      channel: 'email',
    });

    const orchestrator = new OtpOrchestrator(sms, email);
    const session = await orchestrator.sendOtp('+2348012345678', 'NG');

    expect(session.channel).toBe('email');
    expect(session.sessionId).toBe('e2e-email-fallback');
  });

  it('all channels fail: throws with clear message', async () => {
    const sms = new SmsOtpAdapter();
    const email = new EmailOtpAdapter();

    jest.spyOn(sms, 'sendSmsOtp').mockRejectedValue(new ApiError(503, 'SMS down', 'SMS_DOWN'));
    jest.spyOn(email, 'sendEmailOtp').mockRejectedValue(new ApiError(503, 'Email down', 'EMAIL_DOWN'));

    const orchestrator = new OtpOrchestrator(sms, email);

    await expect(orchestrator.sendOtp('+2348012345678', 'NG')).rejects.toThrow(
      'OTP delivery failed via all channels',
    );
  });

  it('delivery status polling works after SMS success', async () => {
    const sms = new SmsOtpAdapter();
    const email = new EmailOtpAdapter();
    const SESSION_ID = 'e2e-status-poll';

    jest.spyOn(sms, 'sendSmsOtp').mockResolvedValue({
      sessionId: SESSION_ID,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      channel: 'sms',
    });
    jest.spyOn(sms, 'getDeliveryStatus').mockResolvedValue({
      sessionId: SESSION_ID,
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
    });

    const orchestrator = new OtpOrchestrator(sms, email);
    await orchestrator.sendOtp('+2348012345678', 'NG');

    const status = await orchestrator.getDeliveryStatus(SESSION_ID);
    expect(status.sessionId).toBe(SESSION_ID);
    expect(status.status).toBe('delivered');
  });
});

// ---------------------------------------------------------------------------
// Flow 3: Flutterwave Send Money (sandbox)
// ---------------------------------------------------------------------------
describe('E2E Flow: Send Money via Flutterwave (sandbox)', () => {
  const SANDBOX_ACCOUNT = '0690000031';
  const SANDBOX_BANK = '044';
  let adapter: ReturnType<typeof createFlutterwaveAdapter>;

  beforeAll(() => {
    if (!HAS_FLW) return;
    adapter = createFlutterwaveAdapter({
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY!,
    });
  });

  itLive('step 1 — verify recipient bank account', async () => {
    const account = await adapter.verifyAccount({
      accountNumber: SANDBOX_ACCOUNT,
      bankCode: SANDBOX_BANK,
    });
    expect(account.accountName.length).toBeGreaterThan(0);
    expect(account.accountNumber).toBe(SANDBOX_ACCOUNT);
  });

  itLive('step 2 — initiate transfer to verified account', async () => {
    const account = await adapter.verifyAccount({
      accountNumber: SANDBOX_ACCOUNT,
      bankCode: SANDBOX_BANK,
    });

    const reference = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const transfer = await adapter.initiateTransfer({
      accountNumber: SANDBOX_ACCOUNT,
      bankCode: SANDBOX_BANK,
      accountName: account.accountName,
      amount: 100,
      narration: 'E2E integration test',
      reference,
    });

    expect(transfer.id).toBeDefined();
    expect(transfer.status).toMatch(/^(NEW|PENDING|SUCCESSFUL|FAILED)$/);
    expect(transfer.amount).toBe(100);
  });

  itLive('step 3 — poll transfer status', async () => {
    const reference = `e2e-status-${Date.now()}`;
    const transfer = await adapter.initiateTransfer({
      accountNumber: SANDBOX_ACCOUNT,
      bankCode: SANDBOX_BANK,
      accountName: 'Test Account',
      amount: 100,
      narration: 'Status poll test',
      reference,
    });

    const status = await adapter.getTransferStatus(transfer.id);

    expect(status.id).toBe(transfer.id);
    expect(status.status).toMatch(/^(NEW|PENDING|SUCCESSFUL|FAILED)$/);
  });

  itLive('full flow — verify → initiate → poll all succeed', async () => {
    // 1. Verify account
    const account = await adapter.verifyAccount({
      accountNumber: SANDBOX_ACCOUNT,
      bankCode: SANDBOX_BANK,
    });
    expect(account.accountName).toBeDefined();

    // 2. Initiate transfer
    const reference = `e2e-full-${Date.now()}`;
    const transfer = await adapter.initiateTransfer({
      accountNumber: SANDBOX_ACCOUNT,
      bankCode: SANDBOX_BANK,
      accountName: account.accountName,
      amount: 100,
      narration: 'Full E2E test',
      reference,
    });
    expect(transfer.id).toBeDefined();

    // 3. Poll status
    const status = await adapter.getTransferStatus(transfer.id);
    expect(status.id).toBe(transfer.id);
  });
});
