/**
 * AfriSend backend server entry point.
 *
 * Reads config from .env, creates service instances, and starts the HTTP server.
 * Run with: npx ts-node src/server/index.ts
 */

import 'dotenv/config';
import { createApp } from './app';
import { DefaultOtpService } from './services/otpService';
import { DefaultAuthService } from './services/authService';
import { DefaultKycService } from './services/kycService';
import { DefaultRemittanceService } from './services/remittanceService';
import { DefaultUserService } from './services/userService';

const PORT = Number(process.env.PORT ?? 3000);

const app = createApp({
  otpService: new DefaultOtpService(),
  authService: new DefaultAuthService(),
  kycService: new DefaultKycService(),
  remittanceService: new DefaultRemittanceService(),
  userService: new DefaultUserService(),
});

app.listen(PORT, () => {
  console.log(`AfriSend API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

export { app };
