import { Page } from '@playwright/test';

// Test fixtures
export const TEST_CREDENTIALS = {
  email: 'mike@gridworx.io',
  password: 'admin123',
};

/**
 * Dismiss the ViewOnboarding modal if present.
 * This modal appears for internal admins on first login to let them choose their default view.
 */
export async function dismissViewOnboarding(page: Page): Promise<void> {
  // Wait a moment for the modal to potentially appear after login
  await page.waitForTimeout(1000);

  const onboardingModal = page.locator('.view-onboarding-overlay');
  const modalCount = await onboardingModal.count();

  if (modalCount > 0) {
    // Click the continue button to dismiss
    const continueBtn = page.locator('.view-onboarding-button.primary');
    await continueBtn.click();
    await onboardingModal.waitFor({ state: 'hidden', timeout: 5000 });
  }
}

/**
 * Login to the application and wait for dashboard.
 * Automatically dismisses ViewOnboarding modal if present.
 */
export async function login(page: Page, email?: string, password?: string): Promise<void> {
  await page.goto('/');

  // Wait for login page
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Fill login form
  await page.fill('input[type="email"]', email || TEST_CREDENTIALS.email);
  await page.fill('input[type="password"]', password || TEST_CREDENTIALS.password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForURL(/.*dashboard.*|.*\/$/, { timeout: 15000 });

  // Dismiss ViewOnboarding modal if present
  await dismissViewOnboarding(page);
}

/**
 * Login and navigate to a specific page.
 * Automatically dismisses ViewOnboarding modal if present.
 */
export async function loginAndNavigateTo(
  page: Page,
  selector: string,
  waitForSelector: string,
  email?: string,
  password?: string
): Promise<void> {
  await login(page, email, password);

  // Navigate to the target page
  await page.click(selector);

  // Wait for the page to load
  await page.waitForSelector(waitForSelector, { timeout: 15000 });
}
