import { auditLog, AuditLogEntry, getAuditLog, clearAuditLog } from '../../src/utils/auditLog';

describe('auditLog', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('records an audit log entry with required fields', () => {
    auditLog({
      service: 'yellowcard',
      operation: 'getRates',
      requestId: 'req-123',
      status: 'success',
    });

    const logs = getAuditLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      service: 'yellowcard',
      operation: 'getRates',
      requestId: 'req-123',
      status: 'success',
    });
  });

  it('includes a timestamp on each entry', () => {
    const before = Date.now();
    auditLog({ service: 'yellowcard', operation: 'initiatePayment', requestId: 'req-1', status: 'success' });
    const after = Date.now();

    const logs = getAuditLog();
    expect(logs[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(logs[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('records optional metadata when provided', () => {
    auditLog({
      service: 'yellowcard',
      operation: 'initiatePayment',
      requestId: 'req-456',
      status: 'failure',
      errorCode: 'INSUFFICIENT_FUNDS',
      durationMs: 342,
      metadata: { amount: '100', currency: 'USD' },
    });

    const logs = getAuditLog();
    expect(logs[0].errorCode).toBe('INSUFFICIENT_FUNDS');
    expect(logs[0].durationMs).toBe(342);
    expect(logs[0].metadata).toEqual({ amount: '100', currency: 'USD' });
  });

  it('accumulates multiple entries in order', () => {
    auditLog({ service: 'yellowcard', operation: 'listCorridors', requestId: 'r1', status: 'success' });
    auditLog({ service: 'yellowcard', operation: 'getRates', requestId: 'r2', status: 'success' });
    auditLog({ service: 'yellowcard', operation: 'initiatePayment', requestId: 'r3', status: 'failure' });

    const logs = getAuditLog();
    expect(logs).toHaveLength(3);
    expect(logs[0].operation).toBe('listCorridors');
    expect(logs[1].operation).toBe('getRates');
    expect(logs[2].operation).toBe('initiatePayment');
  });

  it('clears all entries on clearAuditLog', () => {
    auditLog({ service: 'yellowcard', operation: 'getRates', requestId: 'r1', status: 'success' });
    expect(getAuditLog()).toHaveLength(1);

    clearAuditLog();
    expect(getAuditLog()).toHaveLength(0);
  });

  it('returns a new array snapshot from getAuditLog (immutable)', () => {
    auditLog({ service: 'yellowcard', operation: 'getRates', requestId: 'r1', status: 'success' });
    const logs1 = getAuditLog();
    const logs2 = getAuditLog();
    expect(logs1).not.toBe(logs2);
    expect(logs1).toEqual(logs2);
  });

  it('does not mutate returned snapshot when new entries are added', () => {
    auditLog({ service: 'yellowcard', operation: 'getRates', requestId: 'r1', status: 'success' });
    const snapshot = getAuditLog();

    auditLog({ service: 'yellowcard', operation: 'getRates', requestId: 'r2', status: 'success' });
    expect(snapshot).toHaveLength(1);
    expect(getAuditLog()).toHaveLength(2);
  });

  it('caps log size at 1000 entries to prevent memory leak', () => {
    for (let i = 0; i < 1010; i++) {
      auditLog({ service: 'yellowcard', operation: 'getRates', requestId: `r${i}`, status: 'success' });
    }
    expect(getAuditLog().length).toBeLessThanOrEqual(1000);
  });
});
