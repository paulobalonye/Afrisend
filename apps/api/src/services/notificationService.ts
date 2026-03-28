/**
 * Notification Service — email + push notifications for transaction events.
 *
 * Supported channels: Email (via IEmailNotificationAdapter), Push (via IFcmAdapter).
 * Supported events: transaction_initiated, transaction_completed, transaction_failed,
 *                   kyc_approved, payout_delivered.
 * Supported locales: en, fr, pt (falls back to en for unknown locales).
 *
 * Follows the repository pattern — inject adapters for easy testing.
 */

import { resolveLocale, strings } from './notifications/i18n';
import {
  renderEmailHtml,
  buildTransactionInitiatedBody,
  buildTransactionCompletedBody,
  buildTransactionFailedBody,
  buildKycApprovedBody,
  buildPayoutDeliveredBody,
} from './notifications/templates';

// ─── Public types ─────────────────────────────────────────────────────────────

export enum NotificationEvent {
  TransactionInitiated = 'transaction_initiated',
  TransactionCompleted = 'transaction_completed',
  TransactionFailed    = 'transaction_failed',
  KycApproved          = 'kyc_approved',
  PayoutDelivered      = 'payout_delivered',
}

export enum NotificationChannel {
  Email = 'email',
  Push  = 'push',
}

export type NotificationPayload = {
  event: NotificationEvent;
  locale: string;
  userId: string;
  email?: string;
  fcmToken?: string;
  data: Record<string, string>;
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export type NotifyResult = {
  email?: SendResult;
  push?: SendResult;
};

// ─── Adapter interfaces ───────────────────────────────────────────────────────

export interface IEmailNotificationAdapter {
  sendEmail(to: string, subject: string, html: string): Promise<SendResult>;
}

export interface IFcmAdapter {
  sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<SendResult>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class NotificationService {
  constructor(
    private readonly emailAdapter: IEmailNotificationAdapter,
    private readonly fcmAdapter: IFcmAdapter,
  ) {}

  /**
   * Send notifications over the specified channels.
   * Channels are processed in parallel; a failure on one does not block the other.
   */
  async notify(
    payload: NotificationPayload,
    channels: NotificationChannel[],
  ): Promise<NotifyResult> {
    const locale = resolveLocale(payload.locale);
    const result: NotifyResult = {};

    const tasks: Promise<void>[] = [];

    if (channels.includes(NotificationChannel.Email) && payload.email) {
      tasks.push(
        this._sendEmail(payload.email, payload.event, locale, payload.data).then(r => {
          result.email = r;
        }),
      );
    }

    if (channels.includes(NotificationChannel.Push) && payload.fcmToken) {
      tasks.push(
        this._sendPush(payload.fcmToken, payload.event, locale, payload.data).then(r => {
          result.push = r;
        }),
      );
    }

    await Promise.all(tasks);
    return result;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async _sendEmail(
    to: string,
    event: NotificationEvent,
    locale: ReturnType<typeof resolveLocale>,
    data: Record<string, string>,
  ): Promise<SendResult> {
    const t = strings[locale];
    const { subject, title, bodyHtml } = this._resolveEmailContent(event, t, data);

    const html = renderEmailHtml({ title, preheader: subject, bodyHtml });
    return this.emailAdapter.sendEmail(to, subject, html);
  }

  private async _sendPush(
    token: string,
    event: NotificationEvent,
    locale: ReturnType<typeof resolveLocale>,
    data: Record<string, string>,
  ): Promise<SendResult> {
    const t = strings[locale];
    const { title, body } = this._resolvePushContent(event, t, data);

    const pushData: Record<string, string> = {
      event,
      ...(data.transactionId ? { transactionId: data.transactionId } : {}),
    };

    return this.fcmAdapter.sendPush(token, title, body, pushData);
  }

  private _resolveEmailContent(
    event: NotificationEvent,
    t: typeof strings['en'],
    data: Record<string, string>,
  ): { subject: string; title: string; bodyHtml: string } {
    switch (event) {
      case NotificationEvent.TransactionInitiated:
        return {
          subject: t.transactionInitiated.emailSubject,
          title: t.transactionInitiated.emailTitle,
          bodyHtml: buildTransactionInitiatedBody(data),
        };
      case NotificationEvent.TransactionCompleted:
        return {
          subject: t.transactionCompleted.emailSubject,
          title: t.transactionCompleted.emailTitle,
          bodyHtml: buildTransactionCompletedBody(data),
        };
      case NotificationEvent.TransactionFailed:
        return {
          subject: t.transactionFailed.emailSubject,
          title: t.transactionFailed.emailTitle,
          bodyHtml: buildTransactionFailedBody(data),
        };
      case NotificationEvent.KycApproved:
        return {
          subject: t.kycApproved.emailSubject,
          title: t.kycApproved.emailTitle,
          bodyHtml: buildKycApprovedBody(data),
        };
      case NotificationEvent.PayoutDelivered:
        return {
          subject: t.payoutDelivered.emailSubject,
          title: t.payoutDelivered.emailTitle,
          bodyHtml: buildPayoutDeliveredBody(data),
        };
    }
  }

  private _resolvePushContent(
    event: NotificationEvent,
    t: typeof strings['en'],
    data: Record<string, string>,
  ): { title: string; body: string } {
    const amount = data.amount ?? '';
    const currency = data.currency ?? '';

    switch (event) {
      case NotificationEvent.TransactionInitiated:
        return {
          title: t.transactionInitiated.pushTitle,
          body: t.transactionInitiated.pushBody(amount, currency),
        };
      case NotificationEvent.TransactionCompleted:
        return {
          title: t.transactionCompleted.pushTitle,
          body: t.transactionCompleted.pushBody(amount, currency),
        };
      case NotificationEvent.TransactionFailed:
        return {
          title: t.transactionFailed.pushTitle,
          body: t.transactionFailed.pushBody(data.failureReason),
        };
      case NotificationEvent.KycApproved:
        return {
          title: t.kycApproved.pushTitle,
          body: t.kycApproved.pushBody,
        };
      case NotificationEvent.PayoutDelivered:
        return {
          title: t.payoutDelivered.pushTitle,
          body: t.payoutDelivered.pushBody(amount, currency),
        };
    }
  }
}
