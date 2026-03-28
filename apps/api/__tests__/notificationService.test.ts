/**
 * Notification Service Tests — TDD RED phase.
 *
 * Tests for email + push notifications for transaction events,
 * with EN/FR/PT localization support.
 */

import {
  NotificationService,
  NotificationEvent,
  NotificationChannel,
  IEmailNotificationAdapter,
  IFcmAdapter,
  NotificationPayload,
  SendResult,
} from '../src/services/notificationService';

// ─── Mock adapters ────────────────────────────────────────────────────────────

class MockEmailAdapter implements IEmailNotificationAdapter {
  public sent: Array<{ to: string; subject: string; html: string }> = [];

  async sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
    this.sent.push({ to, subject, html });
    return { success: true, messageId: `email-${Date.now()}` };
  }
}

class MockFcmAdapter implements IFcmAdapter {
  public sent: Array<{ token: string; title: string; body: string; data?: Record<string, string> }> = [];
  public failNext = false;

  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<SendResult> {
    if (this.failNext) {
      this.failNext = false;
      return { success: false, error: 'FCM delivery failed' };
    }
    this.sent.push({ token, title, body, data });
    return { success: true, messageId: `fcm-${Date.now()}` };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(opts?: {
  email?: IEmailNotificationAdapter;
  fcm?: IFcmAdapter;
}): NotificationService {
  const email = opts?.email ?? new MockEmailAdapter();
  const fcm = opts?.fcm ?? new MockFcmAdapter();
  return new NotificationService(email, fcm);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  describe('constructor', () => {
    it('should construct with email and FCM adapters', () => {
      const service = makeService();
      expect(service).toBeDefined();
    });
  });

  // ─── Email notifications ───────────────────────────────────────────────────

  describe('sendEmail', () => {
    it('sends transaction_initiated email in English', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionInitiated,
        locale: 'en',
        userId: 'user-1',
        email: 'user@example.com',
        data: {
          amount: '100',
          currency: 'USD',
          targetAmount: '82000',
          targetCurrency: 'NGN',
          transactionId: 'txn-abc',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Email]);

      expect(result.email?.success).toBe(true);
      expect(email.sent).toHaveLength(1);
      expect(email.sent[0].to).toBe('user@example.com');
      expect(email.sent[0].subject).toContain('initiated');
    });

    it('sends transaction_completed email in French', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionCompleted,
        locale: 'fr',
        userId: 'user-1',
        email: 'user@example.com',
        data: {
          amount: '100',
          currency: 'EUR',
          targetAmount: '75000',
          targetCurrency: 'XOF',
          transactionId: 'txn-xyz',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Email]);

      expect(result.email?.success).toBe(true);
      expect(email.sent[0].subject).toMatch(/terminée|complétée|réussie/i);
    });

    it('sends transaction_failed email in Portuguese', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionFailed,
        locale: 'pt',
        userId: 'user-1',
        email: 'user@example.com',
        data: {
          amount: '50',
          currency: 'USD',
          targetAmount: '28000',
          targetCurrency: 'AOA',
          transactionId: 'txn-fail',
          failureReason: 'Insufficient funds',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Email]);

      expect(result.email?.success).toBe(true);
      expect(email.sent[0].subject).toMatch(/falhou|falha/i);
    });

    it('sends kyc_approved email', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.KycApproved,
        locale: 'en',
        userId: 'user-1',
        email: 'user@example.com',
        data: {},
      };

      const result = await service.notify(payload, [NotificationChannel.Email]);

      expect(result.email?.success).toBe(true);
      expect(email.sent[0].subject).toMatch(/approved|verified/i);
    });

    it('sends payout_delivered email', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.PayoutDelivered,
        locale: 'en',
        userId: 'user-1',
        email: 'user@example.com',
        data: {
          amount: '82000',
          currency: 'NGN',
          recipientName: 'Amara Osei',
          transactionId: 'txn-delivered',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Email]);

      expect(result.email?.success).toBe(true);
      expect(email.sent[0].subject).toMatch(/delivered|payout/i);
    });

    it('includes transaction data in email body', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionInitiated,
        locale: 'en',
        userId: 'user-1',
        email: 'user@example.com',
        data: {
          amount: '250',
          currency: 'USD',
          targetAmount: '205000',
          targetCurrency: 'NGN',
          transactionId: 'txn-check-data',
        },
      };

      await service.notify(payload, [NotificationChannel.Email]);

      expect(email.sent[0].html).toContain('250');
      expect(email.sent[0].html).toContain('USD');
    });
  });

  // ─── Push notifications ────────────────────────────────────────────────────

  describe('sendPush', () => {
    it('sends push notification for transaction_initiated', async () => {
      const fcm = new MockFcmAdapter();
      const service = makeService({ fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionInitiated,
        locale: 'en',
        userId: 'user-1',
        fcmToken: 'fcm-token-abc',
        data: {
          amount: '100',
          currency: 'USD',
          targetAmount: '82000',
          targetCurrency: 'NGN',
          transactionId: 'txn-push-1',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Push]);

      expect(result.push?.success).toBe(true);
      expect(fcm.sent).toHaveLength(1);
      expect(fcm.sent[0].token).toBe('fcm-token-abc');
    });

    it('sends push notification for transaction_completed in French', async () => {
      const fcm = new MockFcmAdapter();
      const service = makeService({ fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionCompleted,
        locale: 'fr',
        userId: 'user-1',
        fcmToken: 'fcm-token-fr',
        data: {
          amount: '200',
          currency: 'EUR',
          targetAmount: '150000',
          targetCurrency: 'XOF',
          transactionId: 'txn-fr-push',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Push]);

      expect(result.push?.success).toBe(true);
      expect(fcm.sent[0].title).toBeDefined();
      expect(fcm.sent[0].body).toBeDefined();
    });

    it('sends push notification for payout_delivered in Portuguese', async () => {
      const fcm = new MockFcmAdapter();
      const service = makeService({ fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.PayoutDelivered,
        locale: 'pt',
        userId: 'user-1',
        fcmToken: 'fcm-token-pt',
        data: {
          amount: '50000',
          currency: 'AOA',
          recipientName: 'Carlos',
          transactionId: 'txn-pt-payout',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Push]);

      expect(result.push?.success).toBe(true);
    });

    it('handles FCM delivery failure gracefully', async () => {
      const fcm = new MockFcmAdapter();
      fcm.failNext = true;
      const service = makeService({ fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionFailed,
        locale: 'en',
        userId: 'user-1',
        fcmToken: 'bad-token',
        data: {
          amount: '100',
          currency: 'USD',
          transactionId: 'txn-fail-push',
          failureReason: 'Network error',
        },
      };

      const result = await service.notify(payload, [NotificationChannel.Push]);

      expect(result.push?.success).toBe(false);
      expect(result.push?.error).toBeDefined();
    });

    it('skips push when no fcmToken provided', async () => {
      const fcm = new MockFcmAdapter();
      const service = makeService({ fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionInitiated,
        locale: 'en',
        userId: 'user-1',
        // no fcmToken
        data: { transactionId: 'txn-no-token' },
      };

      const result = await service.notify(payload, [NotificationChannel.Push]);

      expect(result.push).toBeUndefined();
      expect(fcm.sent).toHaveLength(0);
    });
  });

  // ─── Multi-channel ─────────────────────────────────────────────────────────

  describe('multi-channel notify', () => {
    it('sends both email and push when both channels specified', async () => {
      const email = new MockEmailAdapter();
      const fcm = new MockFcmAdapter();
      const service = makeService({ email, fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionCompleted,
        locale: 'en',
        userId: 'user-1',
        email: 'user@example.com',
        fcmToken: 'fcm-token-123',
        data: {
          amount: '100',
          currency: 'USD',
          targetAmount: '82000',
          targetCurrency: 'NGN',
          transactionId: 'txn-both',
        },
      };

      const result = await service.notify(payload, [
        NotificationChannel.Email,
        NotificationChannel.Push,
      ]);

      expect(result.email?.success).toBe(true);
      expect(result.push?.success).toBe(true);
      expect(email.sent).toHaveLength(1);
      expect(fcm.sent).toHaveLength(1);
    });

    it('still sends email even if push fails', async () => {
      const email = new MockEmailAdapter();
      const fcm = new MockFcmAdapter();
      fcm.failNext = true;
      const service = makeService({ email, fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.KycApproved,
        locale: 'en',
        userId: 'user-1',
        email: 'user@example.com',
        fcmToken: 'bad-token',
        data: {},
      };

      const result = await service.notify(payload, [
        NotificationChannel.Email,
        NotificationChannel.Push,
      ]);

      expect(result.email?.success).toBe(true);
      expect(result.push?.success).toBe(false);
    });
  });

  // ─── Localization ──────────────────────────────────────────────────────────

  describe('localization', () => {
    it('falls back to English for unsupported locale', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionInitiated,
        locale: 'de', // unsupported
        userId: 'user-1',
        email: 'user@example.com',
        data: { transactionId: 'txn-de', amount: '100', currency: 'EUR' },
      };

      const result = await service.notify(payload, [NotificationChannel.Email]);

      expect(result.email?.success).toBe(true);
      expect(email.sent).toHaveLength(1);
    });

    it('generates French email subject for transaction_initiated', async () => {
      const email = new MockEmailAdapter();
      const service = makeService({ email });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionInitiated,
        locale: 'fr',
        userId: 'user-1',
        email: 'user@example.com',
        data: { transactionId: 'txn-fr', amount: '100', currency: 'EUR' },
      };

      await service.notify(payload, [NotificationChannel.Email]);

      // French subject should not be English
      expect(email.sent[0].subject).not.toMatch(/^Transfer initiated/i);
    });

    it('generates Portuguese push title for payout_delivered', async () => {
      const fcm = new MockFcmAdapter();
      const service = makeService({ fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.PayoutDelivered,
        locale: 'pt',
        userId: 'user-1',
        fcmToken: 'fcm-pt',
        data: {
          amount: '5000',
          currency: 'MZN',
          transactionId: 'txn-pt-push',
        },
      };

      await service.notify(payload, [NotificationChannel.Push]);

      expect(fcm.sent[0].title).not.toMatch(/^Payout delivered/i);
    });
  });

  // ─── Push data payload ─────────────────────────────────────────────────────

  describe('push data payload', () => {
    it('includes transactionId in push data', async () => {
      const fcm = new MockFcmAdapter();
      const service = makeService({ fcm });

      const payload: NotificationPayload = {
        event: NotificationEvent.TransactionCompleted,
        locale: 'en',
        userId: 'user-1',
        fcmToken: 'fcm-data-test',
        data: {
          transactionId: 'txn-data-check',
          amount: '100',
          currency: 'USD',
        },
      };

      await service.notify(payload, [NotificationChannel.Push]);

      expect(fcm.sent[0].data?.transactionId).toBe('txn-data-check');
      expect(fcm.sent[0].data?.event).toBe(NotificationEvent.TransactionCompleted);
    });
  });
});
