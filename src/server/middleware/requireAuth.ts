/**
 * requireAuth middleware.
 *
 * Validates the Authorization: Bearer <token> header and attaches a userId to
 * the request.  In production this would verify a JWT (RS256); for the sandbox
 * we accept any non-empty bearer token and derive a deterministic userId from it
 * so tests can rely on a stable value.
 */

import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from './errorHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const body: ApiResponse<null> = { success: false, data: null, error: 'Unauthorized' };
    res.status(401).json(body);
    return;
  }

  const token = authHeader.slice(7);
  if (!token) {
    const body: ApiResponse<null> = { success: false, data: null, error: 'Unauthorized' };
    res.status(401).json(body);
    return;
  }

  // Sandbox: derive userId from token. Replace with real JWT verification in production.
  req.userId = `user-from-${token}`;
  next();
}
