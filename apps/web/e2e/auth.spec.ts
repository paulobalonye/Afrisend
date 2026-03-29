/**
 * E2E tests for authentication flows.
 *
 * Covers: registration, login, OTP verification, MFA challenge.
 */
import { test, expect } from '@playwright/test';
import { mockAuthEndpoints, TEST_USER, TEST_TOKENS } from './helpers';

test.describe('Registration', () => {
  test('should register a new user and redirect to login', async ({ page }) => {
    await mockAuthEndpoints(page);

    await page.goto('/auth/register');

    await page.fill('#firstName', 'Ada');
    await page.fill('#lastName', 'Obi');
    await page.fill('#email', 'ada@example.com');
    await page.fill('#phone', '+2348012345678');
    await page.fill('#password', 'SecurePass123!');
    await page.fill('#confirmPassword', 'SecurePass123!');

    await page.click('button:has-text("Create account")');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/auth/register');

    await page.click('button:has-text("Create account")');

    const errors = page.locator('text=/required|invalid/i');
    await expect(errors.first()).toBeVisible();
  });

  test('should show error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/register');

    await page.fill('#firstName', 'Ada');
    await page.fill('#lastName', 'Obi');
    await page.fill('#email', 'ada@example.com');
    await page.fill('#phone', '+2348012345678');
    await page.fill('#password', 'SecurePass123!');
    await page.fill('#confirmPassword', 'DifferentPass456!');

    await page.click('button:has-text("Create account")');

    await expect(page.locator('text=/match/i')).toBeVisible();
  });
});

test.describe('Login', () => {
  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await mockAuthEndpoints(page);

    await page.goto('/auth/login');

    await page.fill('#email', 'ada@example.com');
    await page.fill('#password', 'SecurePass123!');

    await page.click('button:has-text("Sign in")');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.route('**/v1/auth/login', (route) =>
      route.fulfill({
        status: 401,
        json: { success: false, data: null, error: 'Invalid credentials' },
      })
    );

    await page.goto('/auth/login');

    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'WrongPassword!');

    await page.click('button:has-text("Sign in")');

    await expect(page.locator('[role="alert"]')).toBeVisible();
  });

  test('should redirect to OTP when MFA is required', async ({ page }) => {
    await page.route('**/v1/auth/login', (route) =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            requiresMfa: true,
            sessionId: 'mfa-session-001',
          },
        },
      })
    );

    await page.goto('/auth/login');

    await page.fill('#email', 'ada@example.com');
    await page.fill('#password', 'SecurePass123!');

    await page.click('button:has-text("Sign in")');

    await expect(page).toHaveURL(/\/auth\/verify-otp/);
  });
});

test.describe('OTP Verification', () => {
  test('should verify OTP via full login-to-OTP flow', async ({ page }) => {
    // Mock login to require MFA (sets temporaryToken in store)
    await page.route('**/v1/auth/login', (route) =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: { requiresMfa: true, sessionId: 'mfa-session-001' },
        },
      })
    );

    await page.route('**/v1/auth/verify-otp', (route) =>
      route.fulfill({
        status: 200,
        json: { success: true, data: { tokens: TEST_TOKENS, user: TEST_USER } },
      })
    );

    await page.route('**/v1/users/me', (route) =>
      route.fulfill({ status: 200, json: { success: true, data: TEST_USER } })
    );

    // Drive login flow to reach OTP page with store state intact
    await page.goto('/auth/login');
    await page.fill('#email', 'ada@example.com');
    await page.fill('#password', 'SecurePass123!');
    await page.click('button:has-text("Sign in")');

    // Should now be on OTP page with temporaryToken set
    await expect(page).toHaveURL(/\/auth\/verify-otp/);

    // Fill 6-digit OTP
    const otpContainer = page.locator('[data-testid="otp-inputs"]');
    const inputs = otpContainer.locator('input');

    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill(String(i + 1));
    }

    const submitBtn = page.locator('button:has-text("Verify")');
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should disable submit when OTP is incomplete', async ({ page }) => {
    // Drive through login to get to OTP page properly
    await page.route('**/v1/auth/login', (route) =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: { requiresMfa: true, sessionId: 'mfa-session-001' },
        },
      })
    );

    await page.goto('/auth/login');
    await page.fill('#email', 'ada@example.com');
    await page.fill('#password', 'SecurePass123!');
    await page.click('button:has-text("Sign in")');

    await expect(page).toHaveURL(/\/auth\/verify-otp/);

    // Fill only 3 digits
    const otpContainer = page.locator('[data-testid="otp-inputs"]');
    const inputs = otpContainer.locator('input');

    for (let i = 0; i < 3; i++) {
      await inputs.nth(i).fill(String(i + 1));
    }

    const submitBtn = page.locator('button:has-text("Verify")');
    await expect(submitBtn).toBeDisabled();
  });
});
