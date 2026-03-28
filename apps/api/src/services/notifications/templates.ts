/**
 * HTML email templates for notification events.
 * Simple, readable templates; swap for a proper template engine if needed.
 */

export type EmailTemplateData = {
  title: string;
  preheader: string;
  bodyHtml: string;
  footerNote?: string;
};

export function renderEmailHtml(data: EmailTemplateData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .header h1 { color: #f97316; margin: 0; font-size: 20px; }
    .body { padding: 32px; color: #374151; line-height: 1.6; }
    .body h2 { margin-top: 0; font-size: 18px; color: #111827; }
    .footer { padding: 16px 32px; background: #f3f4f6; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AfriSend</h1>
    </div>
    <div class="body">
      <h2>${escapeHtml(data.title)}</h2>
      ${data.bodyHtml}
    </div>
    <div class="footer">
      ${data.footerNote ? escapeHtml(data.footerNote) : 'AfriSend &mdash; Fast, secure money transfers across Africa.'}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Per-event body builders ──────────────────────────────────────────────────

export function buildTransactionInitiatedBody(data: Record<string, string>): string {
  return `<p>Your transfer of <strong>${escapeHtml(data.amount ?? '')} ${escapeHtml(data.currency ?? '')}</strong> has been initiated.</p>
  <p>Recipient receives: <strong>${escapeHtml(data.targetAmount ?? '')} ${escapeHtml(data.targetCurrency ?? '')}</strong></p>
  <p>Transaction ID: <code>${escapeHtml(data.transactionId ?? '')}</code></p>
  <p>We'll notify you as soon as the transfer is completed.</p>`;
}

export function buildTransactionCompletedBody(data: Record<string, string>): string {
  return `<p>Your transfer of <strong>${escapeHtml(data.amount ?? '')} ${escapeHtml(data.currency ?? '')}</strong> has been completed successfully.</p>
  ${data.targetAmount ? `<p>Recipient received: <strong>${escapeHtml(data.targetAmount)} ${escapeHtml(data.targetCurrency ?? '')}</strong></p>` : ''}
  <p>Transaction ID: <code>${escapeHtml(data.transactionId ?? '')}</code></p>`;
}

export function buildTransactionFailedBody(data: Record<string, string>): string {
  return `<p>Unfortunately, your transfer of <strong>${escapeHtml(data.amount ?? '')} ${escapeHtml(data.currency ?? '')}</strong> could not be completed.</p>
  ${data.failureReason ? `<p>Reason: ${escapeHtml(data.failureReason)}</p>` : ''}
  <p>Transaction ID: <code>${escapeHtml(data.transactionId ?? '')}</code></p>
  <p>Please try again or contact support if the issue persists.</p>`;
}

export function buildKycApprovedBody(_data: Record<string, string>): string {
  return `<p>Great news! Your identity has been verified and your AfriSend account is now fully activated.</p>
  <p>You can now send money to friends and family across Africa.</p>`;
}

export function buildPayoutDeliveredBody(data: Record<string, string>): string {
  return `<p>Your payout of <strong>${escapeHtml(data.amount ?? '')} ${escapeHtml(data.currency ?? '')}</strong> has been delivered.</p>
  ${data.recipientName ? `<p>Recipient: <strong>${escapeHtml(data.recipientName)}</strong></p>` : ''}
  <p>Transaction ID: <code>${escapeHtml(data.transactionId ?? '')}</code></p>`;
}
