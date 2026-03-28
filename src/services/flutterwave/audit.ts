export type AuditEntry = {
  requestId: string;
  service?: string;
  operation: string;
  outcome: 'success' | 'failure';
  timestamp: string;
  error?: string;
};

type LogInput = Omit<AuditEntry, 'requestId' | 'service'> & {
  requestId?: string;
};

export type AuditLogger = {
  log(entry: LogInput): void;
};

let _idCounter = 0;

function generateRequestId(): string {
  _idCounter += 1;
  return `req-${Date.now()}-${_idCounter}`;
}

/**
 * Creates an audit logger that writes structured JSON entries to stdout.
 * Every payment/KYC API call should be logged via this logger.
 */
export function createAuditLogger(service?: string): AuditLogger {
  return {
    log(input: LogInput): void {
      const entry: AuditEntry = {
        requestId: input.requestId ?? generateRequestId(),
        operation: input.operation,
        outcome: input.outcome,
        timestamp: input.timestamp,
        ...(service !== undefined ? { service } : {}),
        ...(input.error !== undefined ? { error: input.error } : {}),
      };
      console.log(JSON.stringify(entry));
    },
  };
}
