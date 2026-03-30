/**
 * E2E tests for the send money wizard (5-step flow).
 *
 * Tests drive the flow from step 1 to accumulate Zustand store state,
 * matching real user behavior and avoiding guard redirects.
 */
import { test, expect } from '@playwright/test';
import {
  mockAuthenticatedUser,
  mockSendMoneyEndpoints,
  navigateThroughRecipientSelection,
  navigateThroughAmount,
  navigateThroughPaymentMethod,
  TEST_RECIPIENTS,
} from './helpers';

test.describe('Send Money Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockSendMoneyEndpoints(page);
  });

  test('Step 1: should display recipients and select one', async ({ page }) => {
    await page.goto('/send/recipient');

    await expect(page.locator(`text=${TEST_RECIPIENTS[0].nickname}`)).toBeVisible();
    await expect(page.locator(`text=${TEST_RECIPIENTS[1].nickname}`)).toBeVisible();

    await page.locator(`text=${TEST_RECIPIENTS[0].nickname}`).click();

    await expect(page).toHaveURL(/\/send\/amount/);
  });

  test('Step 2: should enter amount and get FX quote', async ({ page }) => {
    // Drive from step 1 to get recipient in store
    await navigateThroughRecipientSelection(page);

    await expect(page).toHaveURL(/\/send\/amount/);

    const amountInput = page.locator('[data-testid="amount-input"]');
    const rateResponse = page.waitForResponse('**/v1/fx/rates');
    await amountInput.fill('100');
    await rateResponse;

    // Quote should be visible
    await expect(page.locator('text=/1,?950/i')).toBeVisible();

    const nextBtn = page.locator('[data-testid="next-button"]');
    await expect(nextBtn).toBeEnabled();
  });

  test('Step 2: next button disabled without valid quote', async ({ page }) => {
    await navigateThroughRecipientSelection(page);

    await expect(page).toHaveURL(/\/send\/amount/);

    const nextBtn = page.locator('[data-testid="next-button"]');
    await expect(nextBtn).toBeDisabled();
  });

  test('Step 3: should select payment method', async ({ page }) => {
    await navigateThroughRecipientSelection(page);
    await navigateThroughAmount(page);

    await expect(page).toHaveURL(/\/send\/payment-method/);

    await expect(page.locator('[data-testid="method-open_banking"]')).toBeVisible();
    await expect(page.locator('[data-testid="method-bank_transfer"]')).toBeVisible();
    await expect(page.locator('[data-testid="method-card"]')).toBeVisible();

    await page.locator('[data-testid="method-bank_transfer"]').click();
    await page.locator('button:has-text("Continue")').click();

    await expect(page).toHaveURL(/\/send\/review/);
  });

  test('Step 4: should display review summary and confirm', async ({ page }) => {
    await navigateThroughRecipientSelection(page);
    await navigateThroughAmount(page);
    await navigateThroughPaymentMethod(page);

    await expect(page).toHaveURL(/\/send\/review/);

    // Should show confirm button
    const confirmBtn = page.locator('button:has-text("Confirm")');
    await expect(confirmBtn).toBeVisible();

    await confirmBtn.click();

    await expect(page).toHaveURL(/\/send\/processing/);
  });

  test('Step 5: should show completed status after polling', async ({ page }) => {
    // Drive the full flow: recipient → amount → payment method → review → processing
    await navigateThroughRecipientSelection(page);
    await navigateThroughAmount(page);
    await navigateThroughPaymentMethod(page);

    await expect(page).toHaveURL(/\/send\/review/);

    const confirmBtn = page.locator('button:has-text("Confirm")');
    await confirmBtn.click();

    await expect(page).toHaveURL(/\/send\/processing/);

    // Should poll and show completed status
    await expect(page.locator('text=/completed/i')).toBeVisible({ timeout: 15_000 });

    // Navigation buttons should appear
    await expect(page.locator('text=/done|dashboard/i').first()).toBeVisible();
  });

  test('Step 5: should show failure status and reason', async ({ page }) => {
    // Override payment status to failed
    await page.route('**/v1/remittance/*', (route) => {
      if (route.request().url().includes('/initiate')) return route.fallback();
      return route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            id: 'pay-001',
            paymentId: 'pay-001',
            status: 'failed',
            failureReason: 'Insufficient funds in source account',
          },
        },
      });
    });

    await navigateThroughRecipientSelection(page);
    await navigateThroughAmount(page);
    await navigateThroughPaymentMethod(page);

    await expect(page).toHaveURL(/\/send\/review/);

    const confirmBtn = page.locator('button:has-text("Confirm")');
    await confirmBtn.click();

    await expect(page).toHaveURL(/\/send\/processing/);
    await expect(page.locator('text=/failed/i').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=/insufficient funds/i')).toBeVisible();
  });
});

test.describe('Recipient Management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockSendMoneyEndpoints(page);
  });

  test('should display recipient list', async ({ page }) => {
    await page.goto('/recipients');

    await expect(page.locator(`text=${TEST_RECIPIENTS[0].nickname}`)).toBeVisible();
    await expect(page.locator(`text=${TEST_RECIPIENTS[1].nickname}`)).toBeVisible();
  });

  test('should add a new recipient', async ({ page }) => {
    await page.route('**/v1/recipients', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: {
            success: true,
            data: {
              id: 'rec-003',
              firstName: 'Amina',
              lastName: 'Diallo',
              nickname: 'Amina Dakar',
              country: 'NG',
              payoutMethod: 'bank_transfer',
            },
          },
        });
      }
      return route.fulfill({ status: 200, json: { success: true, data: TEST_RECIPIENTS } });
    });

    await page.goto('/recipients');

    await page.locator('button:has-text("Add"), a:has-text("Add")').first().click();

    await page.fill('#first-name, [name="firstName"]', 'Amina');
    await page.fill('#last-name, [name="lastName"]', 'Diallo');
    await page.fill('#nickname, [name="nickname"]', 'Amina Dakar');

    const countrySelect = page.locator('#country, [name="country"]');
    await countrySelect.selectOption('NG');

    const payoutSelect = page.locator('#payout-method, [name="payoutMethod"]');
    await payoutSelect.selectOption('bank_transfer');

    await page.fill('#bank-name, [name="bankName"]', 'GTBank');
    await page.fill('#bank-code, [name="bankCode"]', '058');
    await page.fill('#account-number, [name="accountNumber"]', '0123456789');

    const createRequest = page.waitForRequest((req) =>
      req.url().includes('/recipients') && req.method() === 'POST'
    );

    await page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Add")').last().click();

    const request = await createRequest;
    expect(request.method()).toBe('POST');
  });
});
