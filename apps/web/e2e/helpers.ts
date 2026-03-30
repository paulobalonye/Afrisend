/**
 * E2E test helpers — mock API responses and common test utilities.
 *
 * Uses Playwright route interception to mock the backend API,
 * enabling reliable E2E tests without a running backend.
 */
import type { Page } from '@playwright/test';

const API_BASE = '**/v1';

export type MockUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  kycTier: number;
  kycStatus: string;
  createdAt: string;
  role?: string;
};

export const TEST_USER: MockUser = {
  id: 'usr-test-001',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Obi',
  phone: '+2348012345678',
  kycTier: 1,
  kycStatus: 'approved',
  createdAt: '2026-01-15T10:00:00Z',
};

export const TEST_ADMIN_USER: MockUser = {
  ...TEST_USER,
  id: 'usr-admin-001',
  email: 'admin@afrisend.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
};

export const TEST_TOKENS = {
  accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1c3ItdGVzdC0wMDEifQ.mock-access',
  refreshToken: 'mock-refresh-token-abc123',
  expiresAt: '2099-01-01T00:00:00Z',
};

export const TEST_RECIPIENTS = [
  {
    id: 'rec-001',
    userId: 'usr-test-001',
    firstName: 'Emeka',
    lastName: 'Okafor',
    nickname: 'Emeka Lagos',
    country: 'NG',
    payoutMethod: 'bank_transfer',
    accountDetails: {
      bankName: 'GTBank',
      bankCode: '058',
      accountNumber: '0123456789',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rec-002',
    userId: 'usr-test-001',
    firstName: 'Kwame',
    lastName: 'Asante',
    nickname: 'Kwame Accra',
    country: 'GH',
    payoutMethod: 'mobile_money',
    accountDetails: {
      phone: '+233201234567',
      network: 'MTN',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const TEST_CORRIDORS = [
  {
    id: 'GBP-NGN',
    sourceCurrency: 'GBP',
    destinationCurrency: 'NGN',
    destinationCountry: 'NG',
    destinationCountryName: 'Nigeria',
    minAmount: 10,
    maxAmount: 5000,
    isActive: true,
    refreshIntervalSeconds: 30,
  },
  {
    id: 'GBP-GHS',
    sourceCurrency: 'GBP',
    destinationCurrency: 'GHS',
    destinationCountry: 'GH',
    destinationCountryName: 'Ghana',
    minAmount: 10,
    maxAmount: 5000,
    isActive: true,
    refreshIntervalSeconds: 30,
  },
];

export const TEST_QUOTE = {
  quoteId: 'quote-001',
  corridorId: 'GBP-NGN',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 195000,
  exchangeRate: 1950.0,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: '2099-01-01T00:00:00Z',
};

/**
 * Set up mock API routes for authenticated user flows.
 */
export async function mockAuthenticatedUser(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: 'accessToken', value: TEST_TOKENS.accessToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'refreshToken', value: TEST_TOKENS.refreshToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);

  await page.route(`${API_BASE}/users/me`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: TEST_USER } })
  );
}

/**
 * Set up mock API routes for authenticated admin flows.
 */
export async function mockAuthenticatedAdmin(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: 'accessToken', value: TEST_TOKENS.accessToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'refreshToken', value: TEST_TOKENS.refreshToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);

  await page.route(`${API_BASE}/users/me`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: TEST_ADMIN_USER } })
  );
}

/**
 * Set up mock API routes for the auth flow.
 */
export async function mockAuthEndpoints(page: Page): Promise<void> {
  await page.route(`${API_BASE}/auth/register`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: { message: 'Account created' } } })
  );

  await page.route(`${API_BASE}/auth/login`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          requiresMfa: false,
          tokens: TEST_TOKENS,
          user: TEST_USER,
        },
      },
    })
  );

  await page.route(`${API_BASE}/auth/verify-otp`, (route) =>
    route.fulfill({
      status: 200,
      json: { success: true, data: { tokens: TEST_TOKENS, user: TEST_USER } },
    })
  );

  await page.route(`${API_BASE}/users/me`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: TEST_USER } })
  );
}

/**
 * Set up mock API routes for the send money flow.
 */
export async function mockSendMoneyEndpoints(page: Page): Promise<void> {
  await page.route(`${API_BASE}/recipients*`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, json: { success: true, data: TEST_RECIPIENTS } });
    }
    return route.fulfill({ status: 200, json: { success: true, data: TEST_RECIPIENTS[0] } });
  });

  await page.route(`${API_BASE}/fx/corridors`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: TEST_CORRIDORS } })
  );

  await page.route(`${API_BASE}/fx/rates`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: TEST_QUOTE } })
  );

  await page.route(`${API_BASE}/remittance/initiate`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: { id: 'pay-001', paymentId: 'pay-001', status: 'processing' },
      },
    })
  );

  await page.route(`${API_BASE}/remittance/*`, (route) => {
    if (route.request().url().includes('/initiate')) return route.fallback();
    return route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          id: 'pay-001',
          paymentId: 'pay-001',
          status: 'completed',
          sourceAmount: 100,
          destinationAmount: 195000,
          sourceCurrency: 'GBP',
          destinationCurrency: 'NGN',
        },
      },
    });
  });
}

/**
 * Drive the send money flow from step 1 through recipient selection.
 * Returns on the amount page with recipient set in store.
 */
export async function navigateThroughRecipientSelection(page: Page): Promise<void> {
  await page.goto('/send/recipient');
  await page.locator(`text=${TEST_RECIPIENTS[0].nickname}`).click();
  // Now on /send/amount with recipient in store
}

/**
 * Drive through amount page — enter amount, wait for quote, advance.
 */
export async function navigateThroughAmount(page: Page): Promise<void> {
  const amountInput = page.locator('[data-testid="amount-input"]');
  const rateResponse = page.waitForResponse('**/v1/fx/rates');
  await amountInput.fill('100');
  await rateResponse;

  const nextBtn = page.locator('[data-testid="next-button"]');
  await nextBtn.click();
  // Now on /send/payment-method with quote in store
}

/**
 * Drive through payment method selection.
 */
export async function navigateThroughPaymentMethod(page: Page): Promise<void> {
  await page.locator('[data-testid="method-bank_transfer"]').click();
  await page.locator('button:has-text("Continue")').click();
  // Now on /send/review with payment method stored
}

/**
 * Set up mock API routes for the admin dashboard.
 */
export async function mockAdminEndpoints(page: Page): Promise<void> {
  await page.route(`${API_BASE}/admin/transactions*`, (route) => {
    const url = route.request().url();
    if (route.request().method() === 'POST' && url.includes('/override')) {
      return route.fulfill({ status: 200, json: { success: true, data: { status: 'reversed' } } });
    }
    return route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          data: [
            {
              id: 'txn-001',
              userId: 'usr-test-001',
              sourceAmount: 100,
              sourceCurrency: 'GBP',
              destinationAmount: 195000,
              destinationCurrency: 'NGN',
              status: 'processing',
              createdAt: '2026-03-28T10:00:00Z',
            },
            {
              id: 'txn-002',
              userId: 'usr-test-002',
              sourceAmount: 50,
              sourceCurrency: 'GBP',
              destinationAmount: 750,
              destinationCurrency: 'GHS',
              status: 'completed',
              createdAt: '2026-03-27T15:30:00Z',
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
        },
      },
    });
  });

  await page.route(`${API_BASE}/admin/users*`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            data: [
              { ...TEST_ADMIN_USER, monthlyLimit: 5000, accountStatus: 'active' },
              {
                id: 'usr-test-002',
                email: 'bola@example.com',
                firstName: 'Bola',
                lastName: 'Adeyemi',
                kycTier: 0,
                kycStatus: 'pending',
                accountStatus: 'active',
                monthlyLimit: 1000,
                createdAt: '2026-03-01T08:00:00Z',
              },
            ],
            total: 2,
            page: 1,
            limit: 20,
          },
        },
      });
    }
    return route.fulfill({ status: 200, json: { success: true, data: {} } });
  });
}
