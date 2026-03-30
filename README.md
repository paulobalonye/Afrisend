# AfriSend

Cross-border remittance platform for the African diaspora. AfriSend enables fast, affordable money transfers from diaspora communities to recipients across Africa, supporting mobile money and bank transfer payouts.

## Target Market

African diaspora sending money home — primarily from the UK, US, and EU to Nigeria, Ghana, Kenya, and other African corridors.

## Key Features

- **Phone + email OTP authentication** with optional TOTP-based MFA
- **KYC identity verification** via Veriff and Smile Identity (tiered: 1, 2, 3)
- **FX rate quotes** with 15-minute locked pricing
- **Multi-corridor remittance** via YellowCard and Flutterwave
- **Mobile money and bank transfer payouts**
- **AML/sanctions compliance checks** and transaction limits
- **Fraud detection and risk scoring**
- **Admin dashboard** for transaction oversight and corridor management

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js + Express (TypeScript) |
| Mobile App | React Native + Expo |
| Web App | Next.js (TypeScript) |
| Database | PostgreSQL 15 |
| Cache / Rate Limiting | Redis 7 |
| API Gateway | Kong 3.6 |
| Infrastructure | Azure (Terraform) |
| Observability | Prometheus + structured JSON logging |

## Architecture Overview

AfriSend is a monorepo with three main applications and a shared packages layer:

```
AfriSend/
├── apps/
│   ├── api/          # Express backend (primary API server)
│   ├── mobile/       # React Native / Expo mobile app
│   └── web/          # Next.js web app
├── packages/
│   └── shared/       # Shared types and utilities
├── src/              # Root-level mobile app source (legacy layout)
├── infra/            # Terraform infrastructure (Azure dev + prod)
├── kong/             # Kong API gateway declarative config
└── monitoring/       # Prometheus and alerting config
```

The backend is a single Express app with dependency-injected services, mounted under `/v1/`. Kong sits in front for rate limiting and routing in production. PostgreSQL stores all persistent data; Redis handles OTP rate limiting.

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Node.js 20+
- npm 9+

### 1. Configure environment

```bash
cp .env.example .env
```

Fill in your sandbox API keys:

| Variable | Service |
|----------|---------|
| `YELLOWCARD_API_KEY` | YellowCard remittance |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave payouts |
| `VERIFF_API_KEY` | Veriff KYC |
| `SMILE_IDENTITY_PARTNER_ID` | Smile Identity KYC |
| `RESEND_API_KEY` | Email OTP (Resend) |
| `JWT_SECRET` | JWT signing |

Database and Redis variables are pre-filled for the docker-compose defaults — no changes needed for local dev.

### 2. Start the stack

```bash
docker-compose up
```

This starts:

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 3000 | Express API server |
| `postgres` | 5432 | PostgreSQL 15 (schema auto-applied) |
| `redis` | 6379 | Redis 7 (OTP rate limiting) |
| `kong` | 8000 | Kong API gateway |
| `kong-db` | — | Kong's dedicated PostgreSQL instance |

The PostgreSQL schema is applied automatically on first container start via `docker-entrypoint-initdb.d`.

### 3. Verify the stack is healthy

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

### 4. Seed development data (optional)

```bash
npx ts-node src/server/db/seed.ts
```

Creates test users and sample transactions so the mobile and web apps have data to display.

### 5. Run the mobile app

Update `.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/v1
```

Then start Expo:

```bash
npx expo start
```

### 6. Run the web app

```bash
cd apps/web
npm run dev
```

---

## Project Structure

### Backend (`apps/api/src/`)

```
app.ts                     # Express app factory — dependency injection root
index.ts                   # HTTP server entry point
routes/
  auth.ts                  # Authentication: OTP, register, login, MFA
  users.ts                 # User profile and saved recipients
  kyc.ts                   # KYC sessions (Veriff + document upload)
  kycSmile.ts              # KYC via Smile Identity
  remittance.ts            # Corridors, rates, payments (YellowCard)
  transactions.ts          # Transaction lifecycle (initiate, status, cancel)
  fx.ts                    # FX rates and locked quotes
  payout.ts                # Payout routing (internal/service-to-service)
  bank.ts                  # Bank account verification
  compliance.ts            # AML checks and transaction limits
  fraudDetection.ts        # Fraud risk assessment
  webhooks.ts              # Flutterwave and YellowCard payment webhooks
  admin.ts                 # Admin: transactions, users, corridors, metrics
services/
  otpService.ts            # SMS and email OTP
  authService.ts           # Auth token management
  kycService.ts            # KYC session management (Veriff)
  remittanceService.ts     # Remittance via YellowCard
  transactionService.ts    # Transaction CRUD
  fxRateService.ts         # FX rates and quotes
  payoutRoutingService.ts  # Payout routing logic
  userService.ts           # User profile management
  adminService.ts          # Admin operations
  complianceService.ts     # AML/sanctions screening
  fraudDetectionService.ts # Fraud scoring
  jwtService.ts            # JWT sign/verify
  mfaService.ts            # TOTP MFA
  smileIdentityKycService.ts # Smile Identity KYC
middleware/
  requireAuth.ts           # JWT authentication middleware
  requireAdmin.ts          # Admin JWT middleware
  errorHandler.ts          # Global error handler and response helpers
  metricsMiddleware.ts     # Prometheus metrics
  logger.ts                # Structured JSON logging
db/
  pool.ts                  # PostgreSQL connection pool
  migrate.ts               # SQL migration runner
  seed.ts                  # Local dev seed data
  migrations/              # SQL migration files
adapters/
  yellowCardAdapter.ts     # YellowCard API integration
  flutterwaveAdapter.ts    # Flutterwave API integration
  veriffAdapter.ts         # Veriff KYC API integration
  smileIdentityAdapter.ts  # Smile Identity API integration
```

### Mobile App (`apps/mobile/src/` and `src/`)

```
screens/          # Screen components (Onboarding, Send, Recipients, etc.)
components/       # Shared UI components
navigation/       # React Navigation stack and tab navigators
store/            # Redux state management
hooks/            # Custom React hooks
api/              # API client and service calls
i18n/             # Internationalisation
theme/            # Design tokens and styles
utils/            # Utility functions
```

### Web App (`apps/web/`)

```
app/              # Next.js App Router pages and layouts
components/       # Shared UI components
hooks/            # Custom React hooks
lib/              # Utility libraries
types/            # TypeScript type definitions
```

---

## Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Integration tests
npm run test:integration

# All tests (unit + integration)
npm run test:all
```

Coverage threshold: **80% lines** (enforced in jest config).

### E2E Tests

```bash
cd apps/web
npx playwright test
```

---

## Deployment

### Azure Production

Infrastructure is managed with Terraform in `infra/azure-prod/`.

```bash
cd infra/azure-prod
terraform init
terraform plan
terraform apply
```

The production environment uses Azure Container Apps, PostgreSQL Flexible Server, Redis Cache, and Key Vault.

### Docker Compose (Azure Dev)

```bash
docker-compose -f docker-compose.azure-dev.yml up
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch strategy, commit message format, and PR workflow.

**Quick rules:**
- Branch from `main`: `feat/HIT-XX-description`
- Follow conventional commits: `feat:`, `fix:`, `chore:`, etc.
- All PRs require passing tests (80%+ coverage) and a code review
- Never push directly to `main`

---

## API Documentation

See [docs/API.md](./docs/API.md) for the full endpoint reference grouped by service.
