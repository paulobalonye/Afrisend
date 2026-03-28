const MAX_LOG_SIZE = 1000;

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

let entries: AuditLogEntry[] = [];

export function auditLog(input: AuditLogInput): void {
  const entry: AuditLogEntry = { ...input, timestamp: Date.now() };
  const updated = [...entries, entry];
  entries = updated.length > MAX_LOG_SIZE ? updated.slice(updated.length - MAX_LOG_SIZE) : updated;
}

export function getAuditLog(): AuditLogEntry[] {
  return [...entries];
}

export function clearAuditLog(): void {
  entries = [];
}
