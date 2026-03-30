/**
 * Structured JSON logger middleware tests (apps/api) — TDD
 * Runs under ts-jest with proper TypeScript path resolution.
 */

import request from 'supertest';
import express from 'express';
import { createLogger, createLoggerMiddleware } from '@/server/middleware/logger';

describe('createLogger (api)', () => {
  it('returns a pino logger with standard log methods', () => {
    const logger = createLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('emits structured JSON with msg and level fields', () => {
    const chunks: string[] = [];
    const logger = createLogger({ stream: { write: (c: string) => chunks.push(c) } });
    logger.info({ transactionId: 'tx-1' }, 'payment initiated');
    const log = JSON.parse(chunks[0]);
    expect(log.msg).toBe('payment initiated');
    expect(log.transactionId).toBe('tx-1');
    expect(log).toHaveProperty('level');
  });
});

describe('createLoggerMiddleware (api)', () => {
  it('attaches req.log to each request', async () => {
    let capturedLog: unknown;
    const app = express();
    app.use(createLoggerMiddleware());
    app.get('/test', (req, res) => {
      capturedLog = (req as express.Request & { log: unknown }).log;
      res.status(200).send('ok');
    });

    await request(app).get('/test');
    expect(capturedLog).toBeDefined();
    expect(typeof (capturedLog as Record<string, unknown>).info).toBe('function');
  });

  it('logs request details as JSON', async () => {
    const logs: string[] = [];
    const app = express();
    app.use(createLoggerMiddleware({ stream: { write: (c: string) => logs.push(c) } }));
    app.get('/api/health', (_req, res) => res.status(200).send('ok'));

    await request(app).get('/api/health');

    const parsed = logs.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const reqLog = parsed.find(
      (l: Record<string, unknown>) =>
        l.req && (l.req as Record<string, unknown>).method === 'GET',
    );
    expect(reqLog).toBeDefined();
  });
});
