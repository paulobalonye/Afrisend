/**
 * Structured JSON logger middleware tests — TDD (RED → GREEN → REFACTOR)
 *
 * Tests that:
 * - createLogger returns a pino logger instance
 * - createLoggerMiddleware returns an express middleware
 * - Each request produces a structured JSON log entry with key fields
 */

import request from 'supertest';
import express from 'express';
import { createLoggerMiddleware, createLogger } from '@/server/middleware/logger';

describe('createLogger', () => {
  it('returns an object with info, warn, error, debug methods', () => {
    const logger = createLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('accepts a custom stream for output capture', () => {
    const chunks: string[] = [];
    const stream = {
      write(chunk: string) {
        chunks.push(chunk);
      },
    };
    const logger = createLogger({ stream });
    logger.info({ userId: 'u1' }, 'test message');
    expect(chunks.length).toBeGreaterThan(0);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.msg).toBe('test message');
    expect(parsed.userId).toBe('u1');
  });

  it('emits JSON with level field', () => {
    const chunks: string[] = [];
    const stream = { write: (c: string) => chunks.push(c) };
    const logger = createLogger({ stream });
    logger.warn('something odd');
    const parsed = JSON.parse(chunks[0]);
    // pino uses numeric level or "level" key depending on config
    expect(parsed).toHaveProperty('level');
  });
});

describe('createLoggerMiddleware', () => {
  it('returns an express middleware function', () => {
    const middleware = createLoggerMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('attaches a logger to req.log', async () => {
    let capturedLogger: unknown;
    const app = express();
    app.use(createLoggerMiddleware());
    app.get('/check', (req, res) => {
      capturedLogger = (req as express.Request & { log: unknown }).log;
      res.status(200).send('ok');
    });

    await request(app).get('/check');
    expect(capturedLogger).toBeDefined();
    expect(typeof (capturedLogger as Record<string, unknown>).info).toBe('function');
  });

  it('logs request method and url as structured JSON', async () => {
    const logs: string[] = [];
    const stream = { write: (c: string) => logs.push(c) };

    const app = express();
    app.use(createLoggerMiddleware({ stream }));
    app.get('/ping', (_req, res) => res.status(200).send('pong'));

    await request(app).get('/ping');

    // At least one log entry should contain the request info
    const parsed = logs.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const requestLog = parsed.find(
      (l: Record<string, unknown>) =>
        l.req && (l.req as Record<string, unknown>).method === 'GET',
    );
    expect(requestLog).toBeDefined();
  });
});
