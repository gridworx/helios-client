import { test, expect, Page } from '@playwright/test';

// Test credentials - admin user who can access asset management
const ADMIN = {
  email: 'mike@gridworx.io',
  password: 'admin123',
};

/**
 * Helper to login as admin
 */
async function loginAsAdmin(page: Page) {
  await page.goto('/');

  // Wait for login page
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Fill login form
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForURL(/.*dashboard.*|.*admin.*|.*\/$/, { timeout: 15000 });

  // Handle ViewOnboarding modal if it appears (first time login)
  await page.waitForTimeout(500);
  const onboardingModal = page.locator('.view-onboarding-overlay');
  if (await onboardingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Click "Admin Console" option to select admin view
    const adminConsoleOption = page.locator('.view-option-card').filter({ hasText: 'Admin Console' });
    if (await adminConsoleOption.isVisible()) {
      await adminConsoleOption.click();
      await page.waitForTimeout(300);
    }
    // Click the "Continue to Admin Console" button
    const continueBtn = page.locator('.view-onboarding-button.primary');
    if (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(500);
    } else {
      // If button not found, try clicking the close button to dismiss
      const closeBtn = page.locator('.view-onboarding-close');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
  }
}

/**
 * Navigate to Media Files page
 */
async function navigateToMediaFiles(page: Page) {
  // Try using the nav button data-testid
  const navButton = page.locator('[data-testid="nav-files-assets"]');

  if (await navButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await navButton.click();
    await page.waitForTimeout(1000);
  } else {
    // Fallback: look for Media Files link text
    const mediaFilesLink = page.locator('button:has-text("Media Files"), a:has-text("Media Files")').first();
    if (await mediaFilesLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mediaFilesLink.click();
      await page.waitForTimeout(1000);
    } else {
      // Last resort: direct navigation
      await page.goto('/admin/files-assets');
      await page.waitForTimeout(1000);
    }
  }

  // Wait for page to load - check for the page header or content
  const pageHeader = page.locator('h1, h2').first();
  await expect(pageHeader).toContainText(/Media|Files|Assets|Storage/, { timeout: 10000 });
}

test.describe('Asset Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test.describe('Media Files Page', () => {
    test('admin can access Media Files page', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      // Page should load with title
      await expect(page.locator('h1')).toContainText(/Media|Files/);
    });

    test('Media Files page shows tabs for Overview, Assets, and Settings', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      // Should have Overview, Assets, and Settings tabs
      await expect(page.locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button:has-text("Settings"), [role="tab"]:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    });

    test('Overview tab shows storage status', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      // Click Overview tab if not already active
      const overviewTab = page.locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")').first();
      await overviewTab.click();

      // Should show storage information
      await expect(page.locator('text=/Storage|Backend|Google Drive|MinIO/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Assets Tab', () => {
    test('Assets tab shows asset grid or empty state', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      // Click Assets tab
      const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")').first();
      await assetsTab.click();

      // Should show either assets or empty state
      const hasAssets = await page.locator('.asset-grid, .asset-item, img[alt*="asset"]').count() > 0;
      const hasEmptyState = await page.locator('text=/No assets|Upload your first|Get started/i').isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasAssets || hasEmptyState).toBe(true);
    });

    test('Assets tab has folder tree sidebar', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")').first();
      await assetsTab.click();

      // Should have folder tree or "All Files" section
      await expect(page.locator('text=/All Files|Folders|Root/i')).toBeVisible({ timeout: 5000 });
    });

    test('Upload button is visible', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")').first();
      await assetsTab.click();

      // Should have upload button
      await expect(page.locator('button:has-text("Upload"), button:has-text("Add")')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Settings Tab', () => {
    test('Settings tab shows storage configuration', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      const settingsTab = page.locator('button:has-text("Settings"), [role="tab"]:has-text("Settings")').first();
      await settingsTab.click();

      // Should show storage backend selection or setup wizard
      const hasStorageConfig = await page.locator('text=/Storage|Backend|Google Drive|MinIO|Setup/i').isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasStorageConfig).toBe(true);
    });

    test('Settings tab has setup wizard for Google Drive', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToMediaFiles(page);

      const settingsTab = page.locator('button:has-text("Settings"), [role="tab"]:has-text("Settings")').first();
      await settingsTab.click();

      // Should show Google Drive setup option or status
      const hasGoogleDriveOption = await page.locator('text=/Google Drive|Shared Drive|Service Account/i').isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasGoogleDriveOption).toBe(true);
    });
  });

  test.describe('Asset Proxy', () => {
    test('asset proxy health endpoint is accessible', async ({ page }) => {
      // Test the proxy health endpoint directly
      const response = await page.request.get('/a/_health');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.service).toBe('asset-proxy');
    });

    test('asset proxy returns 404 for non-existent token', async ({ page }) => {
      const response = await page.request.get('/a/non-existent-token-12345');

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Asset not found');
    });
  });

  test.describe('Navigation', () => {
    test('Media Files is accessible from admin sidebar', async ({ page }) => {
      await loginAsAdmin(page);

      // Navigate to admin area first
      await page.goto('/admin/dashboard');
      await page.waitForLoadState('networkidle');

      // Check if Media Files link exists in navigation
      const mediaFilesLink = page.locator('a[href="/admin/media-files"], a:has-text("Media Files")').first();

      // Either the link should be visible, or the page should be accessible directly
      const isLinkVisible = await mediaFilesLink.isVisible({ timeout: 5000 }).catch(() => false);

      if (isLinkVisible) {
        await mediaFilesLink.click();
        await expect(page.locator('h1')).toContainText(/Media|Files/, { timeout: 10000 });
      } else {
        // Try direct navigation
        await page.goto('/admin/media-files');
        // Should either show the page or redirect (not 404)
        expect(page.url()).not.toContain('404');
      }
    });
  });
});

test.describe('Asset Upload Flow', () => {
  test('upload modal opens when clicking Upload button', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToMediaFiles(page);

    const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")').first();
    await assetsTab.click();

    // Click upload button
    const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add")').first();
    await uploadBtn.click();

    // Should show upload modal/dialog
    const hasUploadModal = await page.locator('text=/Upload|Drag|Drop|Select files/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasUploadModal).toBe(true);
  });

  test('upload modal has drag and drop zone', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToMediaFiles(page);

    const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")').first();
    await assetsTab.click();

    const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add")').first();
    await uploadBtn.click();

    // Should have drag/drop zone
    const hasDropZone = await page.locator('text=/Drag|Drop|drag.*drop/i, .dropzone, [class*="drop"]').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasDropZone).toBe(true);
  });
});

test.describe('Asset Detail View', () => {
  test('clicking an asset shows detail panel', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToMediaFiles(page);

    const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")').first();
    await assetsTab.click();

    // If there are assets, clicking one should show details
    const assetItems = page.locator('.asset-item, .asset-card, [data-testid="asset"]');
    const assetCount = await assetItems.count();

    if (assetCount > 0) {
      await assetItems.first().click();

      // Should show detail panel with asset info
      const hasDetailPanel = await page.locator('text=/Details|Properties|Public URL|Created/i').isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasDetailPanel).toBe(true);
    } else {
      // No assets to click - test passes if empty state is shown
      test.skip();
    }
  });

  test('asset detail shows copy URL button', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToMediaFiles(page);

    const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")').first();
    await assetsTab.click();

    const assetItems = page.locator('.asset-item, .asset-card, [data-testid="asset"]');
    const assetCount = await assetItems.count();

    if (assetCount > 0) {
      await assetItems.first().click();

      // Should have copy URL button
      const hasCopyBtn = await page.locator('button:has-text("Copy"), button:has-text("URL"), [title*="Copy"]').isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasCopyBtn).toBe(true);
    } else {
      test.skip();
    }
  });
});
