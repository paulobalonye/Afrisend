import { createAuditLogger, AuditEntry } from '@/services/flutterwave/audit';

describe('createAuditLogger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs a success entry with all required fields', () => {
    const logger = createAuditLogger();
    logger.log({
      requestId: 'req-001',
      operation: 'verifyAccount',
      outcome: 'success',
      timestamp: '2026-03-28T10:00:00.000Z',
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleSpy.mock.calls[0][0]) as AuditEntry;
    expect(logged.requestId).toBe('req-001');
    expect(logged.operation).toBe('verifyAccount');
    expect(logged.outcome).toBe('success');
    expect(logged.timestamp).toBe('2026-03-28T10:00:00.000Z');
  });

  it('logs a failure entry with error details', () => {
    const logger = createAuditLogger();
    logger.log({
      requestId: 'req-002',
      operation: 'initiateTransfer',
      outcome: 'failure',
      timestamp: '2026-03-28T10:01:00.000Z',
      error: 'Insufficient funds',
    });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]) as AuditEntry;
    expect(logged.outcome).toBe('failure');
    expect(logged.error).toBe('Insufficient funds');
  });

  it('generates a unique requestId when not provided', () => {
    const logger = createAuditLogger();

    logger.log({ operation: 'getTransferStatus', outcome: 'success', timestamp: new Date().toISOString() });
    logger.log({ operation: 'getTransferStatus', outcome: 'success', timestamp: new Date().toISOString() });

    const first = JSON.parse(consoleSpy.mock.calls[0][0]) as AuditEntry;
    const second = JSON.parse(consoleSpy.mock.calls[1][0]) as AuditEntry;
    expect(first.requestId).toBeDefined();
    expect(second.requestId).toBeDefined();
    expect(first.requestId).not.toBe(second.requestId);
  });

  it('includes the service name prefix in logs', () => {
    const logger = createAuditLogger('flutterwave');
    logger.log({ operation: 'verifyAccount', outcome: 'success', timestamp: new Date().toISOString() });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]) as AuditEntry;
    expect(logged.service).toBe('flutterwave');
  });
});
