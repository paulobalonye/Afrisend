/**
 * Prometheus metrics middleware for AfriSend API.
 *
 * Exposes:
 * - http_requests_total        Counter (method, route, status_code)
 * - http_request_duration_seconds  Histogram (method, route)
 * - Business metrics via AfriSendMetrics class
 *
 * Usage:
 *   const registry = new Registry();
 *   app.use(createMetricsMiddleware(registry));
 *   app.use(createMetricsRouter(registry));
 *   const metrics = new AfriSendMetrics(registry);
 */

import type { Request, Response, NextFunction, Router as ExpressRouter } from 'express';
import { Router } from 'express';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

// ─── HTTP instrumentation ─────────────────────────────────────────────────────

export function createMetricsMiddleware(registry: Registry) {
  const requestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });

  const durationHistogram = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  return function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationSec = Number(durationNs) / 1e9;

      const route = req.route?.path ?? req.path ?? 'unknown';
      const method = req.method;
      const statusCode = String(res.statusCode);

      requestCounter.inc({ method, route, status_code: statusCode });
      durationHistogram.observe({ method, route }, durationSec);
    });

    next();
  };
}

// ─── /metrics endpoint ────────────────────────────────────────────────────────

export function createMetricsRouter(registry: Registry): ExpressRouter {
  const router = Router();

  router.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
    const metrics = await registry.metrics();
    res.set('Content-Type', registry.contentType);
    res.status(200).send(metrics);
  });

  return router;
}

// ─── AfriSend business metrics ────────────────────────────────────────────────

export class AfriSendMetrics {
  readonly transactionSuccessTotal: Counter<string>;
  readonly transactionFailureTotal: Counter<string>;
  readonly payoutProviderLatency: Histogram<string>;
  readonly kycApprovalTotal: Counter<string>;
  readonly fraudDetectionTriggerTotal: Counter<string>;
  readonly apiGatewayThroughput: Counter<string>;
  readonly dbConnectionPoolUsed: Gauge<string>;

  constructor(registry: Registry) {
    this.transactionSuccessTotal = new Counter({
      name: 'transaction_success_total',
      help: 'Total number of successful transactions per corridor',
      labelNames: ['corridor'],
      registers: [registry],
    });

    this.transactionFailureTotal = new Counter({
      name: 'transaction_failure_total',
      help: 'Total number of failed transactions per corridor',
      labelNames: ['corridor', 'reason'],
      registers: [registry],
    });

    this.payoutProviderLatency = new Histogram({
      name: 'payout_provider_latency_seconds',
      help: 'Payout provider response latency in seconds',
      labelNames: ['provider'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });

    this.kycApprovalTotal = new Counter({
      name: 'kyc_approval_total',
      help: 'Total KYC approval events',
      labelNames: ['tier', 'status'],
      registers: [registry],
    });

    this.fraudDetectionTriggerTotal = new Counter({
      name: 'fraud_detection_trigger_total',
      help: 'Total fraud detection triggers',
      labelNames: ['rule'],
      registers: [registry],
    });

    this.apiGatewayThroughput = new Counter({
      name: 'api_gateway_requests_total',
      help: 'Total requests processed through the API gateway',
      labelNames: ['service', 'method'],
      registers: [registry],
    });

    this.dbConnectionPoolUsed = new Gauge({
      name: 'db_connection_pool_used',
      help: 'Current number of database connections in use',
      labelNames: ['pool'],
      registers: [registry],
    });
  }
}
