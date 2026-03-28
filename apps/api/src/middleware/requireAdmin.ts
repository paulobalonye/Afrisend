/**
 * requireAdmin middleware — verifies RS256 JWT and checks the isAdmin claim.
 *
 * Returns 401 when no/invalid token is present.
 * Returns 403 when token is valid but the caller is not an admin.
 * Attaches req.userId and req.isAdmin on success.
 */
import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwtService';
import { ApiResponse } from './errorHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      isAdmin?: boolean;
    }
  }
}

type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function createRequireAdmin(jwtService: JwtService): AsyncMiddleware {
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
      if (!payload.isAdmin) {
        const body: ApiResponse<null> = { success: false, data: null, error: 'Forbidden' };
        res.status(403).json(body);
        return;
      }
      req.userId = payload.userId;
      req.isAdmin = true;
      next();
    } catch {
      const body: ApiResponse<null> = { success: false, data: null, error: 'Unauthorized' };
      res.status(401).json(body);
    }
  };
}
