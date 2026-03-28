/**
 * Shared types for all third-party API adapters.
 *
 * Each adapter follows the repository pattern with a consistent interface.
 * Business logic depends on these abstract types, not on provider specifics.
 */

export type AdapterResult<T> =
  | { success: true; data: T }
  | { success: false; error: AdapterError };

export type AdapterError = {
  code: string;
  message: string;
  retryable: boolean;
  raw?: unknown;
};

export type AuditLogEntry = {
  requestId: string;
  adapter: string;
  method: string;
  timestamp: string;
  durationMs: number;
  outcome: 'success' | 'failure';
  errorCode?: string;
};
