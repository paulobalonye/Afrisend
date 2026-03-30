# AfriSend API Reference

Base URL: `http://localhost:3000` (development) or your Azure Container App URL (production).

All versioned endpoints are prefixed with `/v1/`.

---

## Common Response Format

All endpoints return a consistent JSON envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing or invalid JWT) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate idempotency key) |
| 410 | Gone (e.g. expired FX quote) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### Authentication

Protected endpoints require a `Bearer` JWT in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via the Auth endpoints below.

---

## Health

### `GET /health`

Server health check. No authentication required.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-03-30T12:00:00.000Z" }
```

---

## Auth (`/v1/auth`)

### `POST /v1/auth/otp/send`

Send an SMS OTP to a phone number.

**Body:**
```json
{
  "phone": "+2348012345678",
  "countryCode": "NG"
}
```

---

### `POST /v1/auth/otp/verify`

Verify an SMS OTP.

**Body:**
```json
{
  "sessionId": "string",
  "code": "123456",
  "phone": "+2348012345678"
}
```

---

### `POST /v1/auth/otp/delivery-status`

Check whether an SMS OTP was delivered.

**Body:**
```json
{ "sessionId": "string" }
```

---

### `POST /v1/auth/email/otp/send`

Send an email OTP.

**Body:**
```json
{
  "email": "user@example.com",
  "locale": "en"
}
```

`locale` is optional.

---

### `POST /v1/auth/email/otp/verify`

Verify an email OTP.

**Body:**
```json
{
  "sessionId": "string",
  "code": "123456",
  "email": "user@example.com"
}
```

---

### `POST /v1/auth/register`

Register a new user after verifying OTP.

**Body:**
```json
{
  "phone": "+2348012345678",
  "sessionId": "string"
}
```

**Returns:** `{ accessToken, refreshToken, userId }`

---

### `POST /v1/auth/login`

Authenticate with phone and OTP session.

**Body:**
```json
{
  "phone": "+2348012345678",
  "sessionId": "string"
}
```

**Returns:** `{ accessToken, refreshToken }` or MFA challenge if MFA is enabled.

---

### `POST /v1/auth/token/refresh`

Refresh an access token using a refresh token.

**Body:**
```json
{ "refreshToken": "string" }
```

**Returns:** `{ accessToken, refreshToken }`

---

### `POST /v1/auth/refresh`

Alias for `POST /v1/auth/token/refresh` (backwards compat).

---

### `POST /v1/auth/logout`

Invalidate the current session. **Requires auth.**

**Body:** empty

---

### `POST /v1/auth/mfa/login`

Complete login when MFA is required.

**Body:**
```json
{
  "mfaChallengeToken": "string",
  "totpCode": "123456"
}
```

**Returns:** `{ accessToken, refreshToken }`

---

### `POST /v1/auth/mfa/setup` _(auth required)_

Initiate TOTP MFA setup. Returns a TOTP secret and QR code URI.

---

### `POST /v1/auth/mfa/confirm` _(auth required)_

Confirm MFA setup by verifying a TOTP code.

**Body:**
```json
{ "totpCode": "123456" }
```

---

### `POST /v1/auth/mfa/disable` _(auth required)_

Disable MFA for the current user.

**Body:**
```json
{ "totpCode": "123456" }
```

---

### `GET /v1/auth/mfa/status` _(auth required)_

Get MFA enrollment status for the current user.

---

## Users (`/v1/users`)

### `POST /v1/users/me/profile`

Legacy profile setup endpoint (backwards compat). Sets up user profile post-registration.

**Body:**
```json
{
  "dateOfBirth": "1990-01-15",
  "nationality": "NG",
  "residenceCountry": "GB",
  "purpose": "family"
}
```

`purpose` values: `family`, `business`, `savings`, `education`, `other`

---

### `GET /v1/users/me` _(auth required)_

Get the current user's full profile.

---

### `PATCH /v1/users/me` _(auth required)_

Update the current user's profile.

**Body:** any updatable profile fields (e.g. `residenceCountry`, `purpose`, payout preferences)

---

### `GET /v1/users/me/recipients` _(auth required)_

List the current user's saved recipients.

---

### `POST /v1/users/me/recipients` _(auth required)_

Add a saved recipient.

**Body:**
```json
{
  "name": "Jane Doe",
  "payoutMethod": "mobile_money",
  "phoneNumber": "+2348012345678",
  "accountNumber": null,
  "bankCode": null,
  "country": "NG"
}
```

`payoutMethod` values: `mobile_money`, `bank_transfer`

---

### `PATCH /v1/users/me/recipients/:id` _(auth required)_

Update a saved recipient.

---

### `DELETE /v1/users/me/recipients/:id` _(auth required)_

Delete a saved recipient.

---

## KYC — Veriff (`/v1/kyc`)

### `POST /v1/kyc/sessions`

Create a new KYC verification session.

---

### `GET /v1/kyc/sessions/current`

Get the most recent KYC session for the current user.

---

### `POST /v1/kyc/sessions/:sessionId/documents`

Upload a document for a KYC session. Accepts `multipart/form-data` with a `document` file field.

---

### `POST /v1/kyc/sessions/:sessionId/selfie`

Upload a selfie for a KYC session. Accepts `multipart/form-data` with a `selfie` file field.

---

### `POST /v1/kyc/sessions/:sessionId/address`

Upload a proof-of-address document. Accepts `multipart/form-data` with a `document` file field.

---

### `POST /v1/kyc/sessions/:sessionId/liveness-token`

Get a liveness check token for a KYC session.

---

### `POST /v1/kyc/sessions/:sessionId/submit`

Submit a KYC session for review.

---

### `POST /v1/kyc/veriff/sessions`

Create a Veriff-hosted KYC session (returns Veriff session URL).

---

### `GET /v1/kyc/veriff/sessions/:sessionId/decision`

Get the Veriff decision for a session.

---

### `POST /v1/kyc/webhook`

Veriff webhook receiver. Used by Veriff to push decision callbacks. **Not authenticated by user JWT** — validated by Veriff signature.

---

## KYC — Smile Identity (`/v1/kyc`)

These routes are served alongside Veriff KYC on the same prefix when the Smile Identity service is configured.

### `POST /v1/kyc/submit` _(auth required)_

Submit a Smile Identity KYC request.

**Body:**
```json
{
  "tier": 1,
  "documentType": "national_id"
}
```

`tier` values: `1`, `2`, `3`
`documentType` values: `national_id`, `passport`, `driver_license`

---

### `GET /v1/kyc/status` _(auth required)_

Get the current Smile Identity KYC status for the user.

---

### `POST /v1/kyc/webhook/smile-identity`

Smile Identity async callback webhook. **Not authenticated by user JWT** — validated by Smile Identity signature.

---

## Remittance (`/v1/remittance`)

### `GET /v1/remittance/corridors`

List all supported remittance corridors.

---

### `GET /v1/remittance/v2/rates`

Get a rate quote for a corridor.

**Query params:** depends on implementation; typically `fromCurrency`, `toCurrency`, `amount`.

---

### `POST /v1/remittance/payments`

Initiate a remittance payment via YellowCard.

---

### `GET /v1/remittance/payments/:id`

Get the status of a remittance payment.

---

### `GET /v1/remittance/payments/:id/settlement`

Get settlement details for a completed payment.

---

## Transactions (`/v1/transactions`) _(all require auth)_

### `POST /v1/transactions`

Initiate a new send transaction.

**Body:**
```json
{
  "idempotencyKey": "unique-string",
  "recipientId": "uuid",
  "amount": 100.00,
  "currency": "GBP",
  "targetAmount": 180000,
  "targetCurrency": "NGN",
  "fxRate": 1800.00,
  "payoutRail": "mobile_money",
  "quoteId": "uuid",
  "corridorId": "uuid"
}
```

`idempotencyKey` is required to prevent duplicate transactions.

---

### `GET /v1/transactions/:id`

Get the status and details of a transaction.

---

### `GET /v1/transactions`

List the current user's transactions (paginated).

**Query params:** `page`, `limit`

---

### `POST /v1/transactions/:id/cancel`

Cancel a pending transaction. Only possible if the transaction is still in a cancellable state.

---

## FX (`/v1/fx`)

### `GET /v1/fx/rates`

Get current FX rates for all corridors. **No authentication required.**

---

### `POST /v1/fx/quote`

Generate a 15-minute locked FX quote.

**Body:**
```json
{
  "from_currency": "GBP",
  "to_currency": "NGN",
  "amount": 100.00,
  "direction": "send"
}
```

`direction` values: `send` (you specify the amount you send), `receive` (you specify the amount recipient receives)

**Returns:** `{ quoteId, rate, expiresAt, fromAmount, toAmount }`

---

### `POST /v1/fx/quote/:id/lock`

Atomically lock a quote for use in a transaction. Returns 410 if the quote has expired.

---

## Payout (`/v1/payout`)

These are **internal/service-to-service** endpoints, not intended for direct client use.

### `POST /v1/payout/route`

Route a payout to the appropriate provider.

**Body:**
```json
{
  "transactionId": "string",
  "amount": 180000,
  "currency": "NGN",
  "destinationCountry": "NG",
  "method": "mobile_money",
  "recipient": {
    "name": "Jane Doe",
    "accountNumber": null,
    "bankCode": null,
    "phoneNumber": "+2348012345678"
  }
}
```

`method` values: `mobile_money`, `bank_transfer`

---

### `POST /v1/payout/webhook`

Generic provider status webhook for payout updates.

**Body:**
```json
{
  "transactionId": "string",
  "providerRef": "string",
  "provider": "string",
  "status": "completed",
  "failureReason": null
}
```

`status` values: `pending`, `processing`, `completed`, `failed`

---

## Bank (`/v1/bank`)

### `POST /v1/bank/verify`

Verify a bank account number and return account holder details.

---

## Compliance (`/v1/compliance`) _(all require auth)_

### `POST /v1/compliance/check`

Run a pre-transaction AML/sanctions compliance check.

**Body:**
```json
{
  "transactionId": "string",
  "amount": 100.00,
  "currency": "GBP",
  "senderName": "John Doe",
  "recipientName": "Jane Doe",
  "corridorId": "uuid",
  "kycTier": 2
}
```

---

### `GET /v1/compliance/limits/:userId`

Get current usage and transaction limits for a user.

---

### `POST /v1/compliance/flag/:transactionId`

Manually flag a transaction for compliance review.

---

## Fraud Detection (`/v1/fraud`) _(all require auth)_

### `POST /v1/fraud/assess`

Assess a transaction for fraud risk before authorisation.

**Body:**
```json
{
  "transactionId": "string",
  "amount": 100.00,
  "currency": "GBP",
  "recipientId": "uuid",
  "corridorId": "uuid",
  "deviceId": "string",
  "ipAddress": "string",
  "userAgent": "string",
  "hour": 14
}
```

`hour` is optional; defaults to current UTC hour.

---

### `GET /v1/fraud/decisions/:transactionId`

Get the fraud decision for a transaction.

---

### `GET /v1/fraud/devices/:deviceId`

Get trust information for a device.

---

## Webhooks (`/v1/payment`)

Payment provider callbacks. **Not authenticated by user JWT** — validated by provider HMAC signatures.

### `POST /v1/payment/webhook/flutterwave`

Flutterwave payment event webhook.

### `POST /v1/payment/webhook/yellowcard`

YellowCard payment event webhook.

---

## Admin (`/v1/admin`) _(requires admin JWT)_

Admin endpoints are only accessible with an admin-scoped JWT.

### `GET /v1/admin/transactions`

List all transactions with filters.

**Query params:** `status`, `userId`, `page`, `limit`

---

### `GET /v1/admin/transactions/:id`

Get full details of any transaction.

---

### `POST /v1/admin/transactions/:id/override`

Override a transaction's status.

---

### `GET /v1/admin/users`

List all users with filters.

---

### `PATCH /v1/admin/users/:id`

Update a user's account (e.g. KYC tier, account status).

---

### `GET /v1/admin/fx/corridors`

List all FX corridors with current configuration.

---

### `PATCH /v1/admin/fx/corridors/:id`

Update corridor configuration (rate margin, limits, enabled status).

---

### `GET /v1/admin/compliance`

Get compliance dashboard data.

---

### `GET /v1/admin/metrics/corridors`

Get transaction metrics by corridor.

---

## Error Codes

| HTTP | Scenario |
|------|----------|
| 400 | Missing or invalid request body field |
| 401 | Missing `Authorization` header or expired token |
| 403 | Token valid but insufficient role (e.g. non-admin hitting admin route) |
| 404 | Resource (transaction, session, recipient) not found |
| 409 | Duplicate `idempotencyKey` on transaction create |
| 410 | FX quote has expired (15-minute window passed) |
| 429 | OTP rate limit exceeded (3 requests per 10 minutes per phone) |
| 500 | Unexpected server error — check server logs |
