/**
 * Express app factory.
 *
 * Accepts injectable services so tests can swap in mocks.
 * Call createApp() with real services for production, mock services for tests.
 */

import express from 'express';
import cors from 'cors';
import type { Application } from 'express';

import type { IOtpService } from './services/otpService';
import type { IAuthService } from './services/authService';
import type { IKycService } from './services/kycService';
import type { IRemittanceService } from './services/remittanceService';
import type { IUserService } from './services/userService';
import type { ITransactionService } from './services/transactionService';
import type { IFxRateService } from './services/fxRateService';
import type { IPayoutRoutingService } from './services/payoutRoutingService';
import type { IAdminService } from './services/adminService';
import type { MfaService } from './services/mfaService';
import type { IComplianceService } from './services/complianceService';
import type { IFraudDetectionService } from './services/fraudDetectionService';

import { createAuthRouter } from './routes/auth';
import { createUsersRouter } from './routes/users';
import { createKycRouter } from './routes/kyc';
import { createRemittanceRouter } from './routes/remittance';
import { createBankRouter } from './routes/bank';
import { createWebhooksRouter } from './routes/webhooks';
import { createTransactionRouter } from './routes/transactions';
import { createFxRouter } from './routes/fx';
import { createPayoutRouter } from './routes/payout';
import { createAdminRouter } from './routes/admin';
import { createComplianceRouter } from './routes/compliance';
import { createFraudDetectionRouter } from './routes/fraudDetection';
import { globalErrorHandler, notFound } from './middleware/errorHandler';
import { requireAuth, createRequireAuth } from './middleware/requireAuth';
import { createRequireAdmin } from './middleware/requireAdmin';
import { JwtService } from './services/jwtService';
import { createMetricsMiddleware, createMetricsRouter } from './middleware/metricsMiddleware';
import { createLoggerMiddleware } from './middleware/logger';
import { Registry } from 'prom-client';

export type AppServices = {
  otpService: IOtpService;
  authService: IAuthService;
  kycService: IKycService;
  remittanceService: IRemittanceService;
  userService: IUserService;
  transactionService: ITransactionService;
  fxRateService: IFxRateService;
  payoutRoutingService: IPayoutRoutingService;
  adminService: IAdminService;
  jwtService: JwtService;
  mfaService?: MfaService;
  complianceService?: IComplianceService;
  fraudDetectionService?: IFraudDetectionService;
};

export function createApp(services: AppServices): Application {
  const app = express();

  // ── Observability ─────────────────────────────────────────────────────────
  const metricsRegistry = new Registry();
  app.use(createLoggerMiddleware());
  app.use(createMetricsMiddleware(metricsRegistry));
  app.use(createMetricsRouter(metricsRegistry));

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API v1 routes ─────────────────────────────────────────────────────────
  const authMiddleware = createRequireAuth(services.jwtService);
  app.use('/v1/auth', createAuthRouter(
    services.otpService,
    services.authService,
    services.mfaService,
    authMiddleware
  ));
  app.use('/v1/users', createUsersRouter(services.authService, services.userService));
  app.use('/v1/kyc', createKycRouter(services.kycService));
  app.use('/v1/remittance', createRemittanceRouter(services.remittanceService));
  app.use('/v1/bank', createBankRouter(services.remittanceService));
  app.use('/v1/payment', createWebhooksRouter(services.remittanceService));
  app.use('/v1/transactions', requireAuth, createTransactionRouter(services.transactionService));
  app.use('/v1/fx', createFxRouter(services.fxRateService));
  app.use('/v1/payout', createPayoutRouter(services.payoutRoutingService));
  if (services.complianceService) {
    app.use('/v1/compliance', requireAuth, createComplianceRouter(services.complianceService));
  }
  if (services.fraudDetectionService) {
    app.use('/v1/fraud', requireAuth, createFraudDetectionRouter(services.fraudDetectionService));
  }

  // ── Admin routes (require admin JWT) ─────────────────────────────────────
  const requireAdmin = createRequireAdmin(services.jwtService);
  app.use('/v1/admin', requireAdmin, createAdminRouter(services.adminService));

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req, res) => {
    notFound(res);
  });

  // ── Global error handler ─────────────────────────────────────────────────
  app.use(globalErrorHandler);

  return app;
}
