import type { Request, Response, NextFunction } from 'express';

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, error: null };
  res.status(200).json(body);
}

export function badRequest(res: Response, message: string): void {
  const body: ApiResponse<null> = { success: false, data: null, error: message };
  res.status(400).json(body);
}

export function notFound(res: Response, message = 'Not found'): void {
  const body: ApiResponse<null> = { success: false, data: null, error: message };
  res.status(404).json(body);
}

export function serverError(res: Response, message: string): void {
  const body: ApiResponse<null> = { success: false, data: null, error: message };
  res.status(500).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[server] unhandled error:', message);
  serverError(res, message);
}
