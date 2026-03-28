/**
 * Smile Identity adapter.
 *
 * Wraps the Smile Identity REST API.  The interface is kept minimal — only
 * the operations required by SmileIdentityKycService are exposed.
 *
 * In tests, replace this with a mock that implements `SmileIdentityAdapter`.
 * In production, inject `DefaultSmileIdentityAdapter` with real credentials.
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentType = 'national_id' | 'passport' | 'driver_license';

export type SubmitJobRequest = {
  userId: string;
  tier: number;
  documentType: DocumentType;
  imageBase64: string;
};

export type SubmitJobResponse = {
  smileJobId: string;
  resultCode: string;
  resultText: string;
  actions: Record<string, string>;
};

export type JobStatusResponse = {
  smileJobId: string;
  resultCode: string;
  resultText: string;
  complete: boolean;
};

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SmileIdentityAdapter {
  submitJob(req: SubmitJobRequest): Promise<SubmitJobResponse>;
  getJobStatus(smileJobId: string): Promise<JobStatusResponse>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export type SmileIdentityConfig = {
  apiKey: string;
  partnerId: string;
  apiUrl: string;
  webhookSecret: string;
};

// ─── Concrete implementation ──────────────────────────────────────────────────

export class DefaultSmileIdentityAdapter implements SmileIdentityAdapter {
  private readonly config: SmileIdentityConfig;

  constructor(config: SmileIdentityConfig) {
    this.config = config;
  }

  async submitJob(req: SubmitJobRequest): Promise<SubmitJobResponse> {
    const timestamp = new Date().toISOString();
    const signature = this.buildRequestSignature(timestamp);

    const payload = {
      sec_key: this.config.apiKey,
      signature,
      timestamp,
      partner_id: this.config.partnerId,
      smile_client_id: req.userId,
      job_type: req.tier === 2 ? 4 : 1, // 4=BVN_MFA, 1=BiometricKYC — simplified mapping
      job_id: `${this.config.partnerId}-${req.userId}-${Date.now()}`,
      images: [
        {
          image_type_id: req.documentType === 'passport' ? 0 : 1,
          image: req.imageBase64,
        },
      ],
      id_info: {
        id_type: req.documentType.toUpperCase(),
      },
    };

    const response = await fetch(`${this.config.apiUrl}/smile_identity_services/v1/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Smile Identity API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      smile_job_id?: string;
      result?: {
        ResultCode?: string;
        ResultText?: string;
        Actions?: Record<string, string>;
      };
    };

    return {
      smileJobId: data.smile_job_id ?? payload.job_id,
      resultCode: data.result?.ResultCode ?? 'PENDING',
      resultText: data.result?.ResultText ?? 'Submitted',
      actions: data.result?.Actions ?? {},
    };
  }

  async getJobStatus(smileJobId: string): Promise<JobStatusResponse> {
    const timestamp = new Date().toISOString();
    const signature = this.buildRequestSignature(timestamp);

    const response = await fetch(
      `${this.config.apiUrl}/smile_identity_services/v1/job_status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: this.config.partnerId,
          signature,
          timestamp,
          smile_job_id: smileJobId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Smile Identity status check failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      smile_job_id?: string;
      job_complete?: boolean;
      result?: {
        ResultCode?: string;
        ResultText?: string;
      };
    };

    return {
      smileJobId: data.smile_job_id ?? smileJobId,
      resultCode: data.result?.ResultCode ?? '',
      resultText: data.result?.ResultText ?? '',
      complete: data.job_complete ?? false,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison — both strings must be same byte length
    if (expected.length !== signature.length) return false;

    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
      return false;
    }
  }

  private buildRequestSignature(timestamp: string): string {
    return crypto
      .createHmac('sha256', this.config.apiKey)
      .update(`${timestamp}:${this.config.partnerId}:sid_request`)
      .digest('base64');
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSmileIdentityAdapter(): SmileIdentityAdapter {
  const apiKey = process.env['SMILE_IDENTITY_API_KEY'] ?? '';
  const partnerId = process.env['SMILE_IDENTITY_PARTNER_ID'] ?? '';
  const apiUrl = process.env['SMILE_IDENTITY_API_URL'] ?? 'https://testapi.smileidentity.com';
  const webhookSecret = process.env['SMILE_IDENTITY_WEBHOOK_SECRET'] ?? '';

  return new DefaultSmileIdentityAdapter({ apiKey, partnerId, apiUrl, webhookSecret });
}
