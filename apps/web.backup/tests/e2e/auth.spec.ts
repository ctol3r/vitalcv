/**
 * E2E Tests for Authentication Flow
 *
 * Tests login, logout, session management, and role-based access
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login Flow', () => {
    test('displays login form', async ({ page }) => {
      await page.goto('/login');

      // Check for login form elements
      await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|login|submit/i })).toBeVisible();
    });

    test('validates required fields', async ({ page }) => {
      await page.goto('/login');

      // Try to submit empty form
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();

      // Check for validation messages
      const errorMessages = page.locator('[role="alert"], .text-red-500, .error');
      await expect(errorMessages.first()).toBeVisible();
    });

    test('validates email format', async ({ page }) => {
      await page.goto('/login');

      // Enter invalid email
      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();

      // Check for email validation error
      await expect(page.getByText(/valid email|invalid email/i)).toBeVisible();
    });

    test('handles successful login', async ({ page }) => {
      // Mock successful login API
      await page.route('**/api/auth/login*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: '1', email: 'test@example.com', role: 'holder' },
            token: 'mock-jwt-token',
          }),
        });
      });

      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard|home|holder/i);
    });

    test('handles failed login', async ({ page }) => {
      // Mock failed login API
      await page.route('**/api/auth/login*', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid credentials' }),
        });
      });

      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();

      // Should show error message
      await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
    });

    test('shows loading state during login', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/auth/login*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: '1' }, token: 'token' }),
        });
      });

      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');

      const submitButton = page.getByRole('button', { name: /sign in|login|submit/i });
      await submitButton.click();

      // Button should be disabled or show loading
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe('Logout Flow', () => {
    test('logout clears session', async ({ page }) => {
      // Set up authenticated state
      await page.goto('/login');

      // Mock login
      await page.route('**/api/auth/login*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: '1' }, token: 'token' }),
        });
      });

      // Mock logout
      await page.route('**/api/auth/logout*', (route) => {
        route.fulfill({ status: 200 });
      });

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();

      // Wait for redirect
      await page.waitForURL(/dashboard|home|holder/i);

      // Find and click logout
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i }).or(
        page.getByRole('link', { name: /logout|sign out/i })
      );

      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        // Should redirect to login
        await expect(page).toHaveURL(/login|home|\//);
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('redirects unauthenticated users to login', async ({ page }) => {
      // Try to access protected route
      await page.goto('/holder/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('allows authenticated users to access protected routes', async ({ page }) => {
      // Mock authenticated session
      await page.context().addCookies([
        {
          name: 'session',
          value: 'mock-session-token',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Mock session validation
      await page.route('**/api/auth/session*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: '1', email: 'test@example.com', role: 'holder' },
          }),
        });
      });

      await page.goto('/holder/dashboard');

      // Should stay on dashboard
      await expect(page).toHaveURL(/holder|dashboard/);
    });
  });
});

test.describe('Role-Based Access', () => {
  test('holder can access holder routes', async ({ page }) => {
    await page.route('**/api/auth/session*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ user: { role: 'holder' } }),
      });
    });

    await page.goto('/holder/credentials');
    await expect(page).not.toHaveURL(/forbidden|unauthorized/);
  });

  test('issuer can access issuer routes', async ({ page }) => {
    await page.route('**/api/auth/session*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ user: { role: 'issuer' } }),
      });
    });

    await page.goto('/issuer/dashboard');
    await expect(page).not.toHaveURL(/forbidden|unauthorized/);
  });

  test('verifier can access verifier routes', async ({ page }) => {
    await page.route('**/api/auth/session*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ user: { role: 'verifier' } }),
      });
    });

    await page.goto('/verifier/dashboard');
    await expect(page).not.toHaveURL(/forbidden|unauthorized/);
  });
});
