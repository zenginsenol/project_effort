import type { Page } from '@playwright/test';

/**
 * Auth helper utilities for Clerk test authentication
 *
 * Currently operates in demo mode (middleware bypasses Clerk auth).
 * When real authentication is enabled, these helpers will be updated
 * to use @clerk/testing or proper credential-based sign-in.
 */

export interface SignInOptions {
  email: string;
  password: string;
}

export interface SignUpOptions {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Sign in a test user using Clerk authentication
 *
 * @param page - Playwright page object
 * @param options - Sign-in credentials
 * @returns Promise that resolves when sign-in is complete
 *
 * @example
 * ```ts
 * await signIn(page, {
 *   email: 'test@example.com',
 *   password: 'password123'
 * });
 * ```
 */
export async function signIn(page: Page, options: SignInOptions): Promise<void> {
  // Demo mode: navigate directly to dashboard (auth bypassed)
  // TODO: When Clerk auth is enabled, implement actual sign-in flow:
  // 1. Navigate to /sign-in
  // 2. Fill in email and password fields
  // 3. Click sign-in button
  // 4. Wait for redirect to dashboard

  await page.goto('/dashboard');

  // Verify we're on the dashboard (auth succeeded)
  await page.waitForURL('**/dashboard', { timeout: 5000 });
}

/**
 * Sign up a new test user using Clerk authentication
 *
 * @param page - Playwright page object
 * @param options - Sign-up credentials and user details
 * @returns Promise that resolves when sign-up is complete
 *
 * @example
 * ```ts
 * await signUp(page, {
 *   email: 'newuser@example.com',
 *   password: 'securepassword',
 *   firstName: 'Test',
 *   lastName: 'User'
 * });
 * ```
 */
export async function signUp(page: Page, options: SignUpOptions): Promise<void> {
  // Demo mode: navigate directly to dashboard (auth bypassed)
  // TODO: When Clerk auth is enabled, implement actual sign-up flow:
  // 1. Navigate to /sign-up
  // 2. Fill in email, password, firstName, lastName fields
  // 3. Click sign-up button
  // 4. Handle email verification if required
  // 5. Wait for redirect to dashboard

  await page.goto('/dashboard');

  // Verify we're on the dashboard (sign-up succeeded)
  await page.waitForURL('**/dashboard', { timeout: 5000 });
}

/**
 * Sign out the current user
 *
 * @param page - Playwright page object
 * @returns Promise that resolves when sign-out is complete
 *
 * @example
 * ```ts
 * await signOut(page);
 * ```
 */
export async function signOut(page: Page): Promise<void> {
  // Demo mode: navigate to root (no actual sign-out needed)
  // TODO: When Clerk auth is enabled, implement actual sign-out flow:
  // 1. Click user menu/avatar
  // 2. Click sign-out button
  // 3. Wait for redirect to home/sign-in page

  await page.goto('/');

  // Verify we're on the home page
  await page.waitForURL('/', { timeout: 5000 });
}

/**
 * Check if user is currently authenticated
 *
 * @param page - Playwright page object
 * @returns Promise that resolves to true if authenticated, false otherwise
 *
 * @example
 * ```ts
 * const isAuth = await isAuthenticated(page);
 * if (!isAuth) {
 *   await signIn(page, credentials);
 * }
 * ```
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Demo mode: always return true (auth is bypassed)
  // TODO: When Clerk auth is enabled, check for:
  // 1. Clerk session cookie
  // 2. User menu/avatar visible
  // 3. Or check localStorage/sessionStorage for Clerk tokens

  return true;
}

/**
 * Get the current authenticated user's information
 *
 * @param page - Playwright page object
 * @returns Promise that resolves to user info or null if not authenticated
 *
 * @example
 * ```ts
 * const user = await getCurrentUser(page);
 * console.log(user?.email);
 * ```
 */
export async function getCurrentUser(page: Page): Promise<{ email: string; id: string } | null> {
  // Demo mode: return mock user
  // TODO: When Clerk auth is enabled, fetch from:
  // 1. Clerk session API
  // 2. Page context/cookies
  // 3. Or expose user data via data attributes

  const isAuth = await isAuthenticated(page);
  if (!isAuth) {
    return null;
  }

  return {
    id: 'demo-user-id',
    email: 'demo@example.com',
  };
}

/**
 * Set up authentication state before all tests in a suite
 * Use this in test.beforeEach() or test.beforeAll()
 *
 * @param page - Playwright page object
 * @param options - Sign-in credentials (optional in demo mode)
 * @returns Promise that resolves when auth is set up
 *
 * @example
 * ```ts
 * test.beforeEach(async ({ page }) => {
 *   await setupAuth(page, {
 *     email: 'test@example.com',
 *     password: 'password123'
 *   });
 * });
 * ```
 */
export async function setupAuth(page: Page, options?: SignInOptions): Promise<void> {
  if (options) {
    await signIn(page, options);
  } else {
    // Demo mode: just navigate to dashboard
    await page.goto('/dashboard');
  }
}

/**
 * Clean up authentication state after tests
 * Use this in test.afterEach() or test.afterAll()
 *
 * @param page - Playwright page object
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```ts
 * test.afterEach(async ({ page }) => {
 *   await cleanupAuth(page);
 * });
 * ```
 */
export async function cleanupAuth(page: Page): Promise<void> {
  await signOut(page);
}
