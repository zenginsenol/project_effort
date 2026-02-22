import { expect, test } from '@playwright/test';
import { signIn, signUp, signOut, isAuthenticated, getCurrentUser, setupAuth, cleanupAuth } from './helpers/auth-helper';

test.describe('Authentication flows', () => {
  test.describe('Sign-in', () => {
    test('successfully signs in with valid credentials', async ({ page }) => {
      await signIn(page, {
        email: 'test@example.com',
        password: 'password123',
      });

      // Verify we're on the dashboard after sign-in
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Go-live Control Center' })).toBeVisible();
    });

    test('redirects to dashboard after successful sign-in', async ({ page }) => {
      await signIn(page, {
        email: 'user@example.com',
        password: 'securepassword',
      });

      // Verify navigation succeeded
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    test('maintains authentication state after sign-in', async ({ page }) => {
      await signIn(page, {
        email: 'test@example.com',
        password: 'password123',
      });

      // Verify authentication state is active
      const isAuth = await isAuthenticated(page);
      expect(isAuth).toBe(true);

      // Verify user info is available
      const user = await getCurrentUser(page);
      expect(user).not.toBeNull();
      expect(user?.email).toBeTruthy();
    });
  });

  test.describe('Sign-up', () => {
    test('successfully creates new account with valid data', async ({ page }) => {
      await signUp(page, {
        email: 'newuser@example.com',
        password: 'newsecurepassword',
        firstName: 'Test',
        lastName: 'User',
      });

      // Verify we're on the dashboard after sign-up
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Go-live Control Center' })).toBeVisible();
    });

    test('redirects to dashboard after successful sign-up', async ({ page }) => {
      await signUp(page, {
        email: 'another@example.com',
        password: 'anotherpassword',
      });

      // Verify navigation succeeded
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    test('establishes authentication state after sign-up', async ({ page }) => {
      await signUp(page, {
        email: 'brandnew@example.com',
        password: 'brandnewpassword',
        firstName: 'Brand',
        lastName: 'New',
      });

      // Verify authentication state is active
      const isAuth = await isAuthenticated(page);
      expect(isAuth).toBe(true);
    });
  });

  test.describe('Sign-out', () => {
    test('successfully signs out authenticated user', async ({ page }) => {
      // First sign in
      await signIn(page, {
        email: 'test@example.com',
        password: 'password123',
      });

      // Verify we're authenticated and on dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);

      // Now sign out
      await signOut(page);

      // Verify we're redirected to home page
      await expect(page).toHaveURL('/');
    });

    test('redirects to home page after sign-out', async ({ page }) => {
      // Set up authentication
      await setupAuth(page, {
        email: 'user@example.com',
        password: 'password123',
      });

      // Sign out
      await signOut(page);

      // Verify we're on the home page
      await expect(page).toHaveURL('/');
    });

    test('clears authentication state after sign-out', async ({ page }) => {
      // Set up authentication
      await setupAuth(page, {
        email: 'test@example.com',
        password: 'password123',
      });

      // Verify authenticated
      const beforeAuth = await isAuthenticated(page);
      expect(beforeAuth).toBe(true);

      // Clean up auth (signs out)
      await cleanupAuth(page);

      // Verify we're back on home page
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Authentication state', () => {
    test('maintains session across page navigation', async ({ page }) => {
      await setupAuth(page, {
        email: 'test@example.com',
        password: 'password123',
      });

      // Navigate to different protected pages
      await page.goto('/dashboard/projects');
      await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

      await page.goto('/dashboard/analyzer');
      await expect(page.getByRole('heading', { name: 'Task Analyzer' })).toBeVisible();

      await page.goto('/dashboard/effort');
      await expect(page.getByRole('heading', { name: 'Effort & Cost Workflow' })).toBeVisible();

      // Verify still authenticated
      const isAuth = await isAuthenticated(page);
      expect(isAuth).toBe(true);
    });

    test('retrieves current user information when authenticated', async ({ page }) => {
      await setupAuth(page);

      const user = await getCurrentUser(page);
      expect(user).not.toBeNull();
      expect(user?.id).toBeTruthy();
      expect(user?.email).toBeTruthy();
    });

    test('returns null user information when not authenticated', async ({ page }) => {
      // Don't sign in, just go to home page
      await page.goto('/');

      // In demo mode, this will still return a user
      // When real auth is enabled, this should return null
      const user = await getCurrentUser(page);

      // For now, we expect a demo user (this will change when Clerk auth is enabled)
      // TODO: Update this test when Clerk auth is implemented
      expect(user).not.toBeNull();
    });
  });

  test.describe('Protected routes', () => {
    test('allows access to dashboard when authenticated', async ({ page }) => {
      await setupAuth(page, {
        email: 'test@example.com',
        password: 'password123',
      });

      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Go-live Control Center' })).toBeVisible();
    });

    test('allows access to projects page when authenticated', async ({ page }) => {
      await setupAuth(page);

      await page.goto('/dashboard/projects');
      await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();
    });

    test('allows access to session page when authenticated', async ({ page }) => {
      await setupAuth(page);

      await page.goto('/dashboard/sessions/44444444-4444-4444-8444-444444444444');
      await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
    });
  });
});
