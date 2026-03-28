import { auditLog, AuditLogEntry, getAuditLog, clearAuditLog, PII_KEYS } from '../../src/utils/auditLog';

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

describe('auditLog — PII stripping (M3)', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('strips firstName from metadata', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { firstName: 'Alice', amount: 100 },
    });
    expect(getAuditLog()[0].metadata).toEqual({ amount: 100 });
    expect(getAuditLog()[0].metadata).not.toHaveProperty('firstName');
  });

  it('strips lastName from metadata', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { lastName: 'Smith', currency: 'NGN' },
    });
    expect(getAuditLog()[0].metadata).toEqual({ currency: 'NGN' });
    expect(getAuditLog()[0].metadata).not.toHaveProperty('lastName');
  });

  it('strips dateOfBirth from metadata', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { dateOfBirth: '1990-01-01', reference: 'ref-001' },
    });
    expect(getAuditLog()[0].metadata).toEqual({ reference: 'ref-001' });
    expect(getAuditLog()[0].metadata).not.toHaveProperty('dateOfBirth');
  });

  it('strips email from metadata', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { email: 'alice@example.com', amount: 500 },
    });
    expect(getAuditLog()[0].metadata).not.toHaveProperty('email');
  });

  it('strips phone from metadata', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { phone: '+2348012345678', amount: 200 },
    });
    expect(getAuditLog()[0].metadata).not.toHaveProperty('phone');
  });

  it('strips ssn from metadata', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { ssn: '123-45-6789', amount: 200 },
    });
    expect(getAuditLog()[0].metadata).not.toHaveProperty('ssn');
  });

  it('strips nationalId from metadata', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { nationalId: 'AB123456', amount: 200 },
    });
    expect(getAuditLog()[0].metadata).not.toHaveProperty('nationalId');
  });

  it('strips multiple PII keys at once', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { firstName: 'Alice', lastName: 'Smith', email: 'a@b.com', amount: 100, currency: 'NGN' },
    });
    const meta = getAuditLog()[0].metadata!;
    expect(meta).toEqual({ amount: 100, currency: 'NGN' });
    expect(meta).not.toHaveProperty('firstName');
    expect(meta).not.toHaveProperty('lastName');
    expect(meta).not.toHaveProperty('email');
  });

  it('preserves non-PII metadata fields unchanged', () => {
    auditLog({
      service: 'test',
      operation: 'op',
      requestId: 'r1',
      status: 'success',
      metadata: { amount: 1000, currency: 'NGN', reference: 'ref-abc', status: 'NEW' },
    });
    expect(getAuditLog()[0].metadata).toEqual({
      amount: 1000,
      currency: 'NGN',
      reference: 'ref-abc',
      status: 'NEW',
    });
  });

  it('handles undefined metadata gracefully', () => {
    auditLog({ service: 'test', operation: 'op', requestId: 'r1', status: 'success' });
    expect(getAuditLog()[0].metadata).toBeUndefined();
  });

  it('handles empty metadata object', () => {
    auditLog({ service: 'test', operation: 'op', requestId: 'r1', status: 'success', metadata: {} });
    expect(getAuditLog()[0].metadata).toEqual({});
  });

  it('exports PII_KEYS as a non-empty array of strings', () => {
    expect(Array.isArray(PII_KEYS)).toBe(true);
    expect(PII_KEYS.length).toBeGreaterThan(0);
    PII_KEYS.forEach((key) => expect(typeof key).toBe('string'));
  });

  it('does not mutate the original metadata object passed by caller', () => {
    const original = { firstName: 'Bob', amount: 50 };
    auditLog({ service: 'test', operation: 'op', requestId: 'r1', status: 'success', metadata: original });
    expect(original).toHaveProperty('firstName', 'Bob');
  });
});
