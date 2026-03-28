/**
 * Firebase Cloud Messaging (FCM) adapter interface.
 *
 * Secrets:
 *   FCM_SERVICE_ACCOUNT_JSON  — service account JSON for Admin SDK
 *   FCM_PROJECT_ID            — Firebase project ID
 *
 * The interface follows the repository pattern; inject a mock in tests.
 */

export type FcmSendResult = {
  messageId: string;
  token: string;
  sentAt: string;
};

export type FcmDeliveryStatus = {
  messageId: string;
  status: 'pending' | 'delivered' | 'failed' | 'unregistered';
  updatedAt: string;
  errorCode?: string;
};

export type FcmPushRequest = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
};

export interface IFcmAdapter {
  /**
   * Send a push notification to a single device token.
   * Returns { success: true, messageId } or { success: false, error }.
   */
  sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * Sandbox / no-op FCM adapter used when FCM_SERVICE_ACCOUNT_JSON is not set.
 * Logs the notification rather than sending it.
 */
export class SandboxFcmAdapter implements IFcmAdapter {
  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.info('[FCM sandbox] push →', { token, title, body, data });
    return { success: true, messageId: `sandbox-${Date.now()}` };
  }
}
