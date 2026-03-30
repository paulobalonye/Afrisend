/**
 * E2E tests for the admin dashboard.
 *
 * Covers: transaction monitoring, transaction override, user management.
 * Uses TEST_ADMIN_USER fixture with admin role.
 */
import { test, expect } from '@playwright/test';
import { mockAuthenticatedAdmin, mockAdminEndpoints } from './helpers';

test.describe('Admin Transaction Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedAdmin(page);
    await mockAdminEndpoints(page);
  });

  test('should display transaction list', async ({ page }) => {
    await page.goto('/admin/transactions');

    await expect(page.locator('text=txn-001').first()).toBeVisible();
    await expect(page.locator('td span:has-text("Processing")')).toBeVisible();
    await expect(page.locator('td span:has-text("Completed")')).toBeVisible();
  });

  test('should filter transactions by status', async ({ page }) => {
    await page.goto('/admin/transactions');

    // Register request waiter BEFORE the action that triggers it
    const filterRequest = page.waitForRequest(
      (req) => req.url().includes('/admin/transactions') && req.url().includes('status=failed')
    );

    const statusFilter = page.locator('select').first();
    await statusFilter.selectOption('failed');

    const request = await filterRequest;
    expect(request.url()).toContain('status=failed');
  });

  test('should override a transaction status', async ({ page }) => {
    await page.goto('/admin/transactions');

    // Click Override button on first transaction
    await page.locator('button:has-text("Override")').first().click();

    // Modal should appear
    await expect(page.locator('text=/override/i').nth(1)).toBeVisible();

    // Select new status
    const statusSelect = page.locator('select').last();
    await statusSelect.selectOption('reversed');

    // Enter reason
    await page.locator('textarea').fill('Customer dispute - refund approved');

    // Register request waiter BEFORE clicking
    const overrideRequest = page.waitForRequest(
      (req) => req.url().includes('/override') && req.method() === 'POST'
    );

    await page.locator('button:has-text("Override")').last().click();

    const request = await overrideRequest;
    const payload = request.postDataJSON();
    expect(payload.reason).toBe('Customer dispute - refund approved');
  });
});

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedAdmin(page);
    await mockAdminEndpoints(page);
  });

  test('should display user list', async ({ page }) => {
    await page.goto('/admin/users');

    await expect(page.locator('text=Admin User').first()).toBeVisible();
    await expect(page.locator('text=Bola Adeyemi').first()).toBeVisible();
  });

  test('should filter users by KYC status', async ({ page }) => {
    await page.goto('/admin/users');

    // Register request waiter BEFORE action
    const filterRequest = page.waitForRequest(
      (req) => req.url().includes('/admin/users') && req.url().includes('kycStatus=pending')
    );

    const kycFilter = page.locator('select').first();
    await kycFilter.selectOption('pending');

    const request = await filterRequest;
    expect(request.url()).toContain('kycStatus=pending');
  });

  test('should edit user KYC tier', async ({ page }) => {
    await page.goto('/admin/users');

    // Click Edit button
    await page.locator('button:has-text("Edit")').first().click();

    // Modal should show
    await expect(page.locator('h2:has-text("Edit User")')).toBeVisible();

    // Change KYC tier (first select inside the modal overlay)
    const tierSelect = page.locator('.fixed.inset-0 select').first();
    await tierSelect.selectOption('2');

    // Register request waiter BEFORE save
    const updateRequest = page.waitForRequest(
      (req) => req.url().includes('/admin/users/') && req.method() === 'PATCH'
    );

    await page.locator('button:has-text("Save")').click();

    const request = await updateRequest;
    const payload = request.postDataJSON();
    expect(payload.kycTier).toBe(2);
  });
});
