/**
 * Prometheus metrics middleware tests — TDD (RED → GREEN → REFACTOR)
 *
 * Tests that the metrics middleware:
 * - Registers HTTP request counter and duration histogram
 * - Increments counters on each request (by method, route, status)
 * - Exposes a /metrics endpoint in Prometheus text format
 * - Registers business metric gauges/counters for AfriSend domain
 */

import request from 'supertest';
import express from 'express';
import { Registry, Counter } from 'prom-client';
import {
  createMetricsMiddleware,
  createMetricsRouter,
  AfriSendMetrics,
} from '@/server/middleware/metricsMiddleware';

describe('createMetricsMiddleware', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  it('returns an express middleware function', () => {
    const middleware = createMetricsMiddleware(registry);
    expect(typeof middleware).toBe('function');
    expect(middleware.length).toBe(3); // req, res, next
  });

  it('tracks request count by method, route, and status code', async () => {
    const app = express();
    const registry = new Registry();
    const middleware = createMetricsMiddleware(registry);
    app.use(middleware);
    app.get('/test', (_req, res) => res.status(200).json({ ok: true }));

    await request(app).get('/test');

    const metrics = await registry.getMetricsAsJSON();
    const counter = metrics.find(m => m.name === 'http_requests_total');
    expect(counter).toBeDefined();
    const values = (counter as { values: { labels: Record<string, string>; value: number }[] }).values;
    const hit = values.find(
      v => v.labels.method === 'GET' && v.labels.route === '/test' && v.labels.status_code === '200',
    );
    expect(hit).toBeDefined();
    expect(hit!.value).toBe(1);
  });

  it('records request duration in the histogram', async () => {
    const app = express();
    const registry = new Registry();
    const middleware = createMetricsMiddleware(registry);
    app.use(middleware);
    app.get('/latency', (_req, res) => res.status(200).send('ok'));

    await request(app).get('/latency');

    const metrics = await registry.getMetricsAsJSON();
    const histogram = metrics.find(m => m.name === 'http_request_duration_seconds');
    expect(histogram).toBeDefined();
    // At least one observation was recorded
    const sum = (histogram as { values: { metricName: string; value: number }[] }).values.find(
      v => v.metricName === 'http_request_duration_seconds_sum',
    );
    expect(sum).toBeDefined();
    expect(sum!.value).toBeGreaterThanOrEqual(0);
  });

  it('increments counter for multiple requests across different routes', async () => {
    const app = express();
    const registry = new Registry();
    const middleware = createMetricsMiddleware(registry);
    app.use(middleware);
    app.get('/a', (_req, res) => res.status(200).send('a'));
    app.get('/b', (_req, res) => res.status(404).send('b'));

    await request(app).get('/a');
    await request(app).get('/a');
    await request(app).get('/b');

    const metrics = await registry.getMetricsAsJSON();
    const counter = metrics.find(m => m.name === 'http_requests_total');
    const values = (counter as { values: { labels: Record<string, string>; value: number }[] }).values;

    const aHits = values.find(v => v.labels.route === '/a' && v.labels.status_code === '200');
    const bHits = values.find(v => v.labels.route === '/b' && v.labels.status_code === '404');

    expect(aHits?.value).toBe(2);
    expect(bHits?.value).toBe(1);
  });
});

describe('createMetricsRouter', () => {
  it('exposes GET /metrics returning Prometheus text format', async () => {
    const registry = new Registry();
    const router = createMetricsRouter(registry);
    const app = express();
    app.use(router);

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('/metrics response body contains prometheus metric lines', async () => {
    const registry = new Registry();
    // Register a test metric so output is non-empty
    const c = new Counter({ name: 'test_counter_total', help: 'test', registers: [registry] });
    c.inc();

    const router = createMetricsRouter(registry);
    const app = express();
    app.use(router);

    const res = await request(app).get('/metrics');
    expect(res.text).toContain('test_counter_total');
  });
});

describe('AfriSendMetrics', () => {
  let metrics: AfriSendMetrics;
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    metrics = new AfriSendMetrics(registry);
  });

  it('exposes a transaction_success_total counter', () => {
    expect(metrics.transactionSuccessTotal).toBeDefined();
  });

  it('exposes a transaction_failure_total counter', () => {
    expect(metrics.transactionFailureTotal).toBeDefined();
  });

  it('exposes a payout_provider_latency_seconds histogram', () => {
    expect(metrics.payoutProviderLatency).toBeDefined();
  });

  it('exposes a kyc_approval_total counter', () => {
    expect(metrics.kycApprovalTotal).toBeDefined();
  });

  it('exposes a fraud_detection_trigger_total counter', () => {
    expect(metrics.fraudDetectionTriggerTotal).toBeDefined();
  });

  it('transaction counters increment correctly', async () => {
    metrics.transactionSuccessTotal.inc({ corridor: 'NGN' });
    metrics.transactionSuccessTotal.inc({ corridor: 'NGN' });
    metrics.transactionFailureTotal.inc({ corridor: 'NGN', reason: 'timeout' });

    const all = await registry.getMetricsAsJSON();
    const success = all.find(m => m.name === 'transaction_success_total');
    const failure = all.find(m => m.name === 'transaction_failure_total');

    const successVal = (success as { values: { labels: Record<string, string>; value: number }[] })
      .values.find(v => v.labels.corridor === 'NGN');
    expect(successVal?.value).toBe(2);

    const failureVal = (failure as { values: { labels: Record<string, string>; value: number }[] })
      .values.find(v => v.labels.corridor === 'NGN');
    expect(failureVal?.value).toBe(1);
  });

  it('payout provider latency histogram records observations', async () => {
    metrics.payoutProviderLatency.observe({ provider: 'flutterwave' }, 0.25);
    metrics.payoutProviderLatency.observe({ provider: 'flutterwave' }, 0.50);

    const all = await registry.getMetricsAsJSON();
    const hist = all.find(m => m.name === 'payout_provider_latency_seconds');
    expect(hist).toBeDefined();
    const count = (hist as { values: { labels: Record<string, string>; metricName: string; value: number }[] })
      .values.find(v => v.metricName === 'payout_provider_latency_seconds_count' && v.labels.provider === 'flutterwave');
    expect(count?.value).toBe(2);
  });
});
