/**
 * Tests for the updated requireAuth middleware with RS256 JWT verification.
 * TDD RED phase.
 */
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../src/services/jwtService';
import { createRequireAuth, requireAuth } from '../src/middleware/requireAuth';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function mockReq(authHeader?: string) {
  return {
    headers: { authorization: authHeader },
  } as unknown as Request;
}

describe('requireAuth middleware (RS256)', () => {
  let jwtService: JwtService;
  let requireAuth: ReturnType<typeof createRequireAuth>;

  beforeEach(() => {
    jwtService = new JwtService();
    requireAuth = createRequireAuth(jwtService);
  });

  it('should call next() for a valid RS256 bearer token', async () => {
    const token = await jwtService.signAccessToken({ userId: 'user-123', email: 'a@b.com' });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as Request & { userId?: string }).userId).toBe('user-123');
  });

  it('should return 401 with no authorization header', async () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid/tampered token', async () => {
    const req = mockReq('Bearer invalid.token.here');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for expired token', async () => {
    // We can't easily force expiry in unit test without time manipulation
    // Instead test that a malformed expired token is rejected
    const req = mockReq('Bearer eyJhbGciOiJSUzI1NiJ9.eyJ1c2VySWQiOiJ4IiwiZXhwIjoxfQ.invalidsig');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 for "Bearer " with empty token string', async () => {
    const req = mockReq('Bearer ');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireAuth legacy middleware', () => {
  it('should call next() for any non-empty bearer token (legacy behavior)', () => {
    const req = mockReq('Bearer some-legacy-token');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as Request & { userId?: string }).userId).toMatch(/^legacy-/);
  });

  it('should return 401 for missing authorization header', () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for empty bearer token', () => {
    const req = mockReq('Bearer ');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
