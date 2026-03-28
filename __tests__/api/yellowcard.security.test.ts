/**
 * HIGH-3 security tests: separate circuit breakers for read vs write operations.
 *
 * These tests intentionally do NOT mock the retry utilities so that the real
 * CircuitBreaker implementation is exercised and isolation can be verified.
 */

import { CircuitBreakerState } from '../../src/utils/retry';

// Mock only the I/O boundaries — NOT the retry/circuit-breaker utilities.
jest.mock('../../src/utils/auditLog', () => ({ auditLog: jest.fn() }));

describe('HIGH-3: separate read/write circuit breakers', () => {
  /**
   * Returns a freshly-required yellowcard module with isolated circuit breaker state.
   * Each call produces an independent module instance so tests don't share CB state.
   */
  function loadFreshYellowcard(): {
    yc: typeof import('../../src/api/endpoints/yellowcard');
    mockGet: jest.Mock;
    mockPost: jest.Mock;
  } {
    let yc!: typeof import('../../src/api/endpoints/yellowcard');
    const mockGet = jest.fn();
    const mockPost = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('../../src/api/client', () => ({ get: mockGet, post: mockPost }));
      yc = require('../../src/api/endpoints/yellowcard');
    });

    return { yc, mockGet, mockPost };
  }

  it('exports readCircuitBreaker and writeCircuitBreaker as distinct instances', () => {
    const { yc } = loadFreshYellowcard();
    expect(yc.readCircuitBreaker).toBeDefined();
    expect(yc.writeCircuitBreaker).toBeDefined();
    expect(yc.readCircuitBreaker).not.toBe(yc.writeCircuitBreaker);
  });

  it('write circuit breaker starts in Closed state', () => {
    const { yc } = loadFreshYellowcard();
    expect(yc.writeCircuitBreaker.getState()).toBe(CircuitBreakerState.Closed);
  });

  it('read circuit breaker starts in Closed state', () => {
    const { yc } = loadFreshYellowcard();
    expect(yc.readCircuitBreaker.getState()).toBe(CircuitBreakerState.Closed);
  });

  it('write circuit breaker opens independently without affecting read circuit breaker', async () => {
    const { yc } = loadFreshYellowcard();

    // Drive the write CB to Open by accumulating 5 failures directly on it.
    for (let i = 0; i < 5; i++) {
      await yc.writeCircuitBreaker
        .execute(() => Promise.reject(new Error('forced write failure')))
        .catch(() => {});
    }

    expect(yc.writeCircuitBreaker.getState()).toBe(CircuitBreakerState.Open);
    // Read CB must remain unaffected.
    expect(yc.readCircuitBreaker.getState()).toBe(CircuitBreakerState.Closed);
  });

  it('read circuit breaker opens independently without affecting write circuit breaker', async () => {
    const { yc } = loadFreshYellowcard();

    // Drive the read CB to Open.
    for (let i = 0; i < 5; i++) {
      await yc.readCircuitBreaker
        .execute(() => Promise.reject(new Error('forced read failure')))
        .catch(() => {});
    }

    expect(yc.readCircuitBreaker.getState()).toBe(CircuitBreakerState.Open);
    // Write CB must remain unaffected.
    expect(yc.writeCircuitBreaker.getState()).toBe(CircuitBreakerState.Closed);
  });

  it('read operations succeed after write circuit breaker trips', async () => {
    const { yc, mockGet } = loadFreshYellowcard();
    const mockCorridor = {
      id: 'corridor-ng',
      sourceCurrency: 'USDC',
      destinationCurrency: 'NGN',
      destinationCountry: 'NG',
      destinationCountryName: 'Nigeria',
      minAmount: 10,
      maxAmount: 5000,
      isActive: true,
      refreshIntervalSeconds: 60,
    };

    // Trip write CB.
    for (let i = 0; i < 5; i++) {
      await yc.writeCircuitBreaker
        .execute(() => Promise.reject(new Error('forced write failure')))
        .catch(() => {});
    }
    expect(yc.writeCircuitBreaker.getState()).toBe(CircuitBreakerState.Open);

    // listCorridors uses the read CB — must still work.
    mockGet.mockResolvedValueOnce([mockCorridor]);
    const corridors = await yc.listCorridors();
    expect(corridors).toEqual([mockCorridor]);
  });
});
