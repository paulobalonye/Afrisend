# AfriSend

Cross-border remittance platform for the African diaspora.

## Local Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Node.js 20+ (for running mobile app / tests)

### 1. Configure environment

```bash
cp .env.example .env
```

Fill in your sandbox API keys (YellowCard, Veriff, Resend, Flutterwave). The database and Redis
variables are pre-filled for the docker-compose defaults — no changes needed for local dev.

### 2. Start the stack

```bash
docker-compose up
```

This starts:

| Service    | Port | Description                        |
|------------|------|------------------------------------|
| `backend`  | 3000 | Express API server                 |
| `postgres` | 5432 | PostgreSQL 15 (schema auto-applied)|
| `redis`    | 6379 | Redis 7 (OTP rate limiting)        |

The PostgreSQL schema (`src/server/db/migrations/001_initial_schema.sql`) is applied automatically
on first container start via `docker-entrypoint-initdb.d`.

### 3. Verify the stack is healthy

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

### 4. Seed development data (optional)

```bash
npx ts-node src/server/db/seed.ts
```

Creates two test users and sample transactions so the mobile app has data to display.

### 5. Run the mobile app

Update `.env` to point to the local backend:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/v1
```

Then start Expo:

```bash
npx expo start
```

---

## Running Tests

```bash
# All tests
npx jest

# With coverage
npx jest --coverage

# Single file
npx jest __tests__/server/app.test.ts
```

Coverage threshold: **80% lines** (enforced in `jest.config`).

---

## Backend Server Structure

```
src/server/
  index.ts                   # Entry point — starts HTTP server
  app.ts                     # Express app factory (dependency injection)
  routes/
    auth.ts                  # POST /v1/auth/otp/send, /verify, /register, etc.
    kyc.ts                   # POST/GET /v1/kyc/sessions, Veriff, webhooks
    remittance.ts            # GET /v1/remittance/corridors, rates, payments
    bank.ts                  # POST /v1/bank/verify
    users.ts                 # POST /v1/users/me/profile
    webhooks.ts              # POST /v1/payment/webhook/{flutterwave,yellowcard}
  services/
    otpService.ts            # IOtpService interface + DefaultOtpService
    authService.ts           # IAuthService interface + DefaultAuthService
    kycService.ts            # IKycService interface + DefaultKycService
    remittanceService.ts     # IRemittanceService interface + DefaultRemittanceService
  middleware/
    errorHandler.ts          # ok(), badRequest(), notFound(), globalErrorHandler
  db/
    pool.ts                  # PostgreSQL connection pool (pg)
    migrate.ts               # SQL migration runner
    seed.ts                  # Local dev seed data
    redisOtpRateLimitStore.ts # Redis-backed OTP rate limit store (ioredis)
    migrations/
      001_initial_schema.sql # Users, OTP sessions, KYC, transactions, audit log
  otpRateLimiter.ts          # Server-side OTP rate limiter (3 req / 10 min)
```

---

## Docker Compose Services

### PostgreSQL

- Image: `postgres:15-alpine`
- Database: `afrisend_dev`
- User: `afrisend` / Password: `afrisend_dev_password`
- Schema applied from: `src/server/db/migrations/*.sql`

### Redis

- Image: `redis:7-alpine`
- Used for: OTP rate limiting (shared across backend instances)

### Backend

- Built from `Dockerfile.backend`
- Runs: `npx ts-node src/server/index.ts`
- Waits for healthy PostgreSQL and Redis before starting

---

## API Endpoints (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /v1/auth/otp/send | Send SMS OTP |
| POST | /v1/auth/otp/verify | Verify SMS OTP |
| POST | /v1/auth/otp/delivery-status | Check SMS delivery |
| POST | /v1/auth/email/otp/send | Send email OTP |
| POST | /v1/auth/email/otp/verify | Verify email OTP |
| POST | /v1/auth/register | Register user |
| POST | /v1/auth/refresh | Refresh access token |
| POST | /v1/auth/logout | Logout |
| POST | /v1/users/me/profile | Set up user profile |
| POST | /v1/kyc/sessions | Create KYC session |
| GET | /v1/kyc/sessions/current | Get current KYC session |
| POST | /v1/kyc/sessions/:id/liveness-token | Get liveness token |
| POST | /v1/kyc/sessions/:id/submit | Submit KYC session |
| POST | /v1/kyc/veriff/sessions | Create Veriff session |
| POST | /v1/kyc/webhook | Veriff webhook |
| GET | /v1/remittance/corridors | List corridors |
| GET | /v1/remittance/v2/rates | Get rate quote |
| POST | /v1/remittance/payments | Initiate payment |
| GET | /v1/remittance/payments/:id | Payment status |
| GET | /v1/remittance/payments/:id/settlement | Settlement info |
| POST | /v1/bank/verify | Verify bank account |
| POST | /v1/payment/webhook/flutterwave | Flutterwave webhook |
| POST | /v1/payment/webhook/yellowcard | YellowCard webhook |
