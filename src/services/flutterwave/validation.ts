import { FlutterwaveError } from './types';

/** Matches exactly 10 decimal digits (Nigerian NUBAN format). */
const NUBAN_RE = /^\d{10}$/;

/** Bank code: 3–9 alphanumeric characters, no whitespace. */
const BANK_CODE_RE = /^[A-Za-z0-9]{3,9}$/;

/** Transfer ID: one or more decimal digits only (no path separators). */
const TRANSFER_ID_RE = /^\d+$/;

/** RFC 1918 private ranges, loopback, and link-local CIDRs. */
const PRIVATE_IP_RE =
  /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|127\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+)$/;

const LOOPBACK_HOSTNAMES = new Set(['localhost', '::1', '[::1]']);

export function validateTransferId(transferId: string): void {
  if (!TRANSFER_ID_RE.test(transferId)) {
    throw new FlutterwaveError(
      `Invalid transferId: must contain only digits, got "${transferId}"`,
    );
  }
}

export function validateNuban(accountNumber: string): void {
  if (!NUBAN_RE.test(accountNumber)) {
    throw new FlutterwaveError(
      `Invalid accountNumber: must be a 10-digit NUBAN, got "${accountNumber}"`,
    );
  }
}

export function validateBankCode(bankCode: string): void {
  if (!BANK_CODE_RE.test(bankCode)) {
    throw new FlutterwaveError(
      `Invalid bankCode: must be 3–9 alphanumeric characters, got "${bankCode}"`,
    );
  }
}

export function validateAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new FlutterwaveError(
      `Invalid amount: must be a positive finite number, got ${amount}`,
    );
  }
}

export function validateNarration(narration: string): void {
  // Reject any C0 or C1 control characters (U+0000–U+001F, U+007F–U+009F)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F-\x9F]/.test(narration)) {
    throw new FlutterwaveError(
      'Invalid narration: must not contain control characters',
    );
  }
}

export function validateCallbackUrl(
  callbackUrl: string,
  allowedDomains: string[] | undefined,
): void {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    throw new FlutterwaveError(`Invalid callbackUrl: not a valid URL`);
  }

  if (parsed.protocol !== 'https:') {
    throw new FlutterwaveError(
      `Invalid callbackUrl: must use HTTPS, got "${parsed.protocol}"`,
    );
  }

  const hostname = parsed.hostname;

  if (LOOPBACK_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new FlutterwaveError(
      `Invalid callbackUrl: loopback address "${hostname}" is not permitted`,
    );
  }

  if (PRIVATE_IP_RE.test(hostname)) {
    throw new FlutterwaveError(
      `Invalid callbackUrl: private/internal address "${hostname}" is not permitted`,
    );
  }

  if (!allowedDomains || allowedDomains.length === 0) {
    throw new FlutterwaveError(
      'Invalid callbackUrl: no allowed domains configured — set callbackAllowedDomains in adapter config',
    );
  }

  const hostLower = hostname.toLowerCase();
  const isAllowed = allowedDomains.some((domain) => hostLower === domain.toLowerCase());
  if (!isAllowed) {
    throw new FlutterwaveError(
      `Invalid callbackUrl: hostname "${hostname}" is not in the allowed domains list`,
    );
  }
}
