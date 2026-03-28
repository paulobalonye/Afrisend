const MAX_LOG_SIZE = 1000;

export const PII_KEYS: ReadonlyArray<string> = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'email',
  'phone',
  'ssn',
  'nationalId',
  'passport',
  'address',
  'bvn',
  'nin',
];

export type AuditLogEntry = {
  service: string;
  operation: string;
  requestId: string;
  status: 'success' | 'failure';
  timestamp: number;
  durationMs?: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
};

type AuditLogInput = Omit<AuditLogEntry, 'timestamp'>;

function stripPii(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !(PII_KEYS as ReadonlyArray<string>).includes(key)),
  );
}

let entries: AuditLogEntry[] = [];

export function auditLog(input: AuditLogInput): void {
  const safeMetadata = input.metadata !== undefined ? stripPii(input.metadata) : undefined;
  const entry: AuditLogEntry = { ...input, metadata: safeMetadata, timestamp: Date.now() };
  const updated = [...entries, entry];
  entries = updated.length > MAX_LOG_SIZE ? updated.slice(updated.length - MAX_LOG_SIZE) : updated;
}

export function getAuditLog(): AuditLogEntry[] {
  return [...entries];
}

export function clearAuditLog(): void {
  entries = [];
}
