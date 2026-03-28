/**
 * requireAuth middleware unit tests — TDD
 */

import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '@/server/middleware/requireAuth';

function makeMocks(authHeader?: string) {
  const req = {
    headers: { authorization: authHeader },
    userId: undefined as string | undefined,
  } as unknown as Request;

  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, status, json, next };
}

describe('requireAuth', () => {
  it('calls next() and sets userId when valid bearer token provided', () => {
    const { req, res, next } = makeMocks('Bearer my-token');
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-from-my-token');
  });

  it('returns 401 when Authorization header is absent', () => {
    const { req, res, next } = makeMocks(undefined);
    requireAuth(req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when scheme is not Bearer', () => {
    const { req, res, next } = makeMocks('Basic dXNlcjpwYXNz');
    requireAuth(req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token after Bearer is empty (e.g. "Bearer ")', () => {
    const { req, res, next } = makeMocks('Bearer ');
    requireAuth(req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
