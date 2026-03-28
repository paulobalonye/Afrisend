/**
 * Structured JSON logger middleware for AfriSend API.
 *
 * Uses pino for high-performance structured logging and pino-http for
 * Express request/response logging.
 *
 * Usage:
 *   app.use(createLoggerMiddleware());
 *   // req.log.info({ userId }, 'user action');
 */

import pino from 'pino';
import pinoHttp from 'pino-http';
import type { RequestHandler } from 'express';

export type LoggerOptions = {
  level?: string;
  stream?: { write: (data: string) => void };
};

/** Create a pino logger instance. Pass stream to capture output in tests. */
export function createLogger(opts: LoggerOptions = {}): pino.Logger {
  const { level = process.env.LOG_LEVEL ?? 'info', stream } = opts;

  const baseOptions: pino.LoggerOptions = {
    level,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: 'afrisend-api',
      env: process.env.NODE_ENV ?? 'development',
    },
  };

  if (stream) {
    return pino(baseOptions, stream as pino.DestinationStream);
  }

  return pino(baseOptions);
}

/** Singleton logger for production use. */
export const logger = createLogger();

/** Create a pino-http Express middleware. Pass stream to capture output in tests. */
export function createLoggerMiddleware(opts: LoggerOptions = {}): RequestHandler {
  const { level = process.env.LOG_LEVEL ?? 'info', stream } = opts;

  const pinoInstance = createLogger({ level, stream });

  return pinoHttp({
    logger: pinoInstance,
    autoLogging: true,
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }) as RequestHandler;
}
