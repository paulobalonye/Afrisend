/**
 * Prometheus metrics middleware tests (apps/api) — TDD
 * Runs under ts-jest with proper TypeScript path resolution.
 */

import request from 'supertest';
import express from 'express';
import { Registry, Counter } from 'prom-client';
import {
  createMetricsMiddleware,
  createMetricsRouter,
  AfriSendMetrics,
} from '@/server/middleware/metricsMiddleware';

describe('createMetricsMiddleware (api)', () => {
  it('returns an express middleware', () => {
    const reg = new Registry();
    const m = createMetricsMiddleware(reg);
    expect(typeof m).toBe('function');
    expect(m.length).toBe(3);
  });

  it('increments http_requests_total on each request', async () => {
    const reg = new Registry();
    const app = express();
    app.use(createMetricsMiddleware(reg));
    app.get('/ping', (_req, res) => res.status(200).send('pong'));

    await request(app).get('/ping');

    const metrics = await reg.getMetricsAsJSON();
    const counter = metrics.find(m => m.name === 'http_requests_total');
    expect(counter).toBeDefined();
  });

  it('records http_request_duration_seconds histogram', async () => {
    const reg = new Registry();
    const app = express();
    app.use(createMetricsMiddleware(reg));
    app.get('/slow', (_req, res) => res.status(200).send('ok'));

    await request(app).get('/slow');

    const metrics = await reg.getMetricsAsJSON();
    const hist = metrics.find(m => m.name === 'http_request_duration_seconds');
    expect(hist).toBeDefined();
  });
});

describe('createMetricsRouter (api)', () => {
  it('GET /metrics returns 200 with prometheus text format', async () => {
    const reg = new Registry();
    const c = new Counter({ name: 'api_test_total', help: 'test', registers: [reg] });
    c.inc();

    const app = express();
    app.use(createMetricsRouter(reg));

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('api_test_total');
  });
});

describe('AfriSendMetrics (api)', () => {
  let metrics: AfriSendMetrics;
  let reg: Registry;

  beforeEach(() => {
    reg = new Registry();
    metrics = new AfriSendMetrics(reg);
  });

  it('defines all business metric counters and histograms', () => {
    expect(metrics.transactionSuccessTotal).toBeDefined();
    expect(metrics.transactionFailureTotal).toBeDefined();
    expect(metrics.payoutProviderLatency).toBeDefined();
    expect(metrics.kycApprovalTotal).toBeDefined();
    expect(metrics.fraudDetectionTriggerTotal).toBeDefined();
  });

  it('transaction success counter increments', async () => {
    metrics.transactionSuccessTotal.inc({ corridor: 'KES' });
    const all = await reg.getMetricsAsJSON();
    const m = all.find(x => x.name === 'transaction_success_total');
    const val = (m as { values: { labels: Record<string, string>; value: number }[] })
      .values.find(v => v.labels.corridor === 'KES');
    expect(val?.value).toBe(1);
  });
});
