/**
 * Twilio / OTP Orchestrator Integration Tests
 *
 * The SMS OTP in this codebase flows through the AfriSend backend
 * (SmsOtpAdapter → /auth/otp/send channel=sms → Twilio server-side).
 * Direct Twilio API calls are not made from the mobile app layer.
 *
 * These tests cover the OtpOrchestrator which coordinates:
 *   - SMS-first OTP delivery
 *   - Email fallback on SMS failure
 *   - Delivery status polling
 *   - Input validation
 *
 * The unit tests use mocks; these integration tests test the orchestration
 * logic with real dependencies (but mocked HTTP client).
 */

import { OtpOrchestrator } from '@/services/otp/otpOrchestrator';
import { SmsOtpAdapter } from '@/services/otp/smsOtpAdapter';
import { EmailOtpAdapter } from '@/services/otp/emailOtpAdapter';
import { ApiError } from '@/api/client';

// ---------------------------------------------------------------------------
// Helper — build adapters with controlled responses
// ---------------------------------------------------------------------------
function makeSuccessfulSmsAdapter(sessionId = 'sms-sess-1'): SmsOtpAdapter {
  const adapter = new SmsOtpAdapter();
  jest.spyOn(adapter, 'sendSmsOtp').mockResolvedValue({
    sessionId,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    channel: 'sms',
  });
  jest.spyOn(adapter, 'getDeliveryStatus').mockResolvedValue({
    sessionId,
    status: 'delivered',
    deliveredAt: new Date().toISOString(),
  });
  return adapter;
}

function makeFailingSmsAdapter(statusCode = 503): SmsOtpAdapter {
  const adapter = new SmsOtpAdapter();
  jest.spyOn(adapter, 'sendSmsOtp').mockRejectedValue(
    new ApiError(statusCode, 'SMS service unavailable', 'SMS_SERVICE_ERROR'),
  );
  jest.spyOn(adapter, 'getDeliveryStatus').mockRejectedValue(
    new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND'),
  );
  return adapter;
}

function makeSuccessfulEmailAdapter(sessionId = 'email-sess-1'): EmailOtpAdapter {
  const adapter = new EmailOtpAdapter();
  jest.spyOn(adapter, 'sendEmailOtp').mockResolvedValue({
    sessionId,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    channel: 'email',
  });
  return adapter;
}

function makeFailingEmailAdapter(): EmailOtpAdapter {
  const adapter = new EmailOtpAdapter();
  jest.spyOn(adapter, 'sendEmailOtp').mockRejectedValue(
    new ApiError(503, 'Email service unavailable', 'EMAIL_SERVICE_ERROR'),
  );
  return adapter;
}

// ---------------------------------------------------------------------------
// 1. OtpOrchestrator — SMS-first delivery
// ---------------------------------------------------------------------------
describe('OtpOrchestrator — SMS-first OTP delivery', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns SMS session when SMS succeeds', async () => {
    const sms = makeSuccessfulSmsAdapter('sms-ok-1');
    const email = makeSuccessfulEmailAdapter();
    const orchestrator = new OtpOrchestrator(sms, email);

    const result = await orchestrator.sendOtp('+2348012345678', 'NG');

    expect(result.channel).toBe('sms');
    expect(result.sessionId).toBe('sms-ok-1');
    expect(jest.spyOn(email, 'sendEmailOtp')).not.toHaveBeenCalled();
  });

  it('includes a valid expiresAt timestamp', async () => {
    const sms = makeSuccessfulSmsAdapter();
    const email = makeSuccessfulEmailAdapter();
    const orchestrator = new OtpOrchestrator(sms, email);

    const result = await orchestrator.sendOtp('+2348012345678', 'NG');

    const expiresAt = new Date(result.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
  });
});

// ---------------------------------------------------------------------------
// 2. OtpOrchestrator — Email fallback
// ---------------------------------------------------------------------------
describe('OtpOrchestrator — Email fallback on SMS failure', () => {
  afterEach(() => jest.restoreAllMocks());

  it('falls back to email when SMS returns 503', async () => {
    const sms = makeFailingSmsAdapter(503);
    const email = makeSuccessfulEmailAdapter('email-fallback-1');
    const orchestrator = new OtpOrchestrator(sms, email);

    const result = await orchestrator.sendOtp('+2348012345678', 'NG');

    expect(result.channel).toBe('email');
    expect(result.sessionId).toBe('email-fallback-1');
  });

  it('falls back to email when SMS returns 500', async () => {
    const sms = makeFailingSmsAdapter(500);
    const email = makeSuccessfulEmailAdapter('email-500-fallback');
    const orchestrator = new OtpOrchestrator(sms, email);

    const result = await orchestrator.sendOtp('+1234567890', 'US');

    expect(result.channel).toBe('email');
    expect(result.sessionId).toBe('email-500-fallback');
  });

  it('does NOT fall back when SMS returns 400 (client validation error)', async () => {
    const sms = makeFailingSmsAdapter(400);
    const email = makeSuccessfulEmailAdapter();
    const orchestrator = new OtpOrchestrator(sms, email);

    await expect(orchestrator.sendOtp('+invalid', 'XX')).rejects.toThrow('SMS service unavailable');
  });

  it('does NOT fall back when SMS returns 422 (client validation error)', async () => {
    const sms = makeFailingSmsAdapter(422);
    const email = makeSuccessfulEmailAdapter();
    const orchestrator = new OtpOrchestrator(sms, email);

    await expect(orchestrator.sendOtp('+invalid', 'XX')).rejects.toThrow();
  });

  it('throws when both SMS and email fail', async () => {
    const sms = makeFailingSmsAdapter(503);
    const email = makeFailingEmailAdapter();
    const orchestrator = new OtpOrchestrator(sms, email);

    await expect(orchestrator.sendOtp('+2348012345678', 'NG')).rejects.toThrow(
      'OTP delivery failed via all channels',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. OtpOrchestrator — Delivery status polling
// ---------------------------------------------------------------------------
describe('OtpOrchestrator — delivery status polling', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns delivery status for a valid session', async () => {
    const sms = makeSuccessfulSmsAdapter('poll-sess');
    const email = makeSuccessfulEmailAdapter();
    const orchestrator = new OtpOrchestrator(sms, email);

    const status = await orchestrator.getDeliveryStatus('poll-sess');

    expect(status).toMatchObject({
      sessionId: 'poll-sess',
      status: expect.stringMatching(/^(pending|sent|delivered|failed|undelivered)$/),
    });
  });

  it('throws when session ID is empty', async () => {
    const sms = makeSuccessfulSmsAdapter();
    const email = makeSuccessfulEmailAdapter();
    const orchestrator = new OtpOrchestrator(sms, email);

    await expect(orchestrator.getDeliveryStatus('')).rejects.toThrow('Session ID is required');
  });
});

// ---------------------------------------------------------------------------
// 4. SmsOtpAdapter — input validation
// ---------------------------------------------------------------------------
describe('SmsOtpAdapter — input validation', () => {
  it('throws when phone is empty', async () => {
    const adapter = new SmsOtpAdapter();
    await expect(adapter.sendSmsOtp('', 'NG')).rejects.toThrow('Phone number is required');
  });

  it('throws when countryCode is empty', async () => {
    const adapter = new SmsOtpAdapter();
    await expect(adapter.sendSmsOtp('+2348012345678', '')).rejects.toThrow(
      'Country code is required',
    );
  });

  it('throws when sessionId is empty for getDeliveryStatus', async () => {
    const adapter = new SmsOtpAdapter();
    await expect(adapter.getDeliveryStatus('')).rejects.toThrow('Session ID is required');
  });
});

// ---------------------------------------------------------------------------
// 5. EmailOtpAdapter — input validation
// ---------------------------------------------------------------------------
describe('EmailOtpAdapter — input validation', () => {
  it('throws when phone is empty', async () => {
    const adapter = new EmailOtpAdapter();
    await expect(adapter.sendEmailOtp('', 'NG')).rejects.toThrow('Phone number is required');
  });

  it('throws when countryCode is empty', async () => {
    const adapter = new EmailOtpAdapter();
    await expect(adapter.sendEmailOtp('+2348012345678', '')).rejects.toThrow(
      'Country code is required',
    );
  });
});
