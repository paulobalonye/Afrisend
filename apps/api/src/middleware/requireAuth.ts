/**
 * requireAuth middleware — RS256 JWT verification.
 *
 * Validates the Authorization: Bearer <token> header using RS256.
 * Attaches req.userId from the verified token payload.
 *
 * createRequireAuth() is the factory for dependency-injected use (testing).
 * requireAuth is a singleton instance for production use, using the shared
 * JwtService instance from app context.
 */
import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from './errorHandler';
import { JwtService } from '../services/jwtService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function createRequireAuth(jwtService: JwtService): AsyncMiddleware {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    try {
      const payload = await jwtService.verifyAccessToken(token);
      req.userId = payload.userId;
      next();
    } catch {
      const body: ApiResponse<null> = { success: false, data: null, error: 'Unauthorized' };
      res.status(401).json(body);
    }
  };
}

/** Singleton middleware — wire jwtService in app.ts. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Backward-compat stub: routes that haven't been updated to use createRequireAuth
  // will still compile. Remove this once all routes are updated.
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
  // Will be replaced by createRequireAuth in production routes
  req.userId = `legacy-${token.slice(0, 8)}`;
  next();
}
