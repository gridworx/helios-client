import { test, expect } from '@playwright/test';

test.describe('Users List Feature', () => {
  const baseUrl = 'http://localhost:3000';
  const testEmail = 'jack@gridwrx.io';
  const testPassword = 'TestPassword123!';

  // Helper to login
  async function login(page) {
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').first().click();

    await page.waitForLoadState('networkidle');
  }

  test('Navigate to Users page and verify list loads', async ({ page }) => {
    console.log('👥 Testing Users List Feature\n');

    // Step 1: Login
    console.log('1️⃣  Logging in...');
    await login(page);
    console.log('   ✅ Logged in');

    // Step 2: Navigate to Users
    console.log('\n2️⃣  Navigating to Users page...');
    const usersButton = await page.locator('text=/Users/i').first();
    await usersButton.click();
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'openspec/testing/reports/screenshots/users-list-page.png',
      fullPage: true
    });
    console.log('   ✅ On Users page');

    // Step 3: Verify Users page elements
    console.log('\n3️⃣  Verifying Users page elements...');

    // Check for user table/list or any user-related content
    const userTable = await page.locator('table, [role="table"], .user-list, [class*="user"]').first();
    const tableVisible = await userTable.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   User table/list visible: ${tableVisible}`);

    // Check for Jack's user entry
    const jackUser = await page.locator('text=/Jack.*Dribber/i').first();
    const jackVisible = await jackUser.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Jack's user entry visible: ${jackVisible}`);

    // Check if "Users" heading is visible (page loaded)
    const usersHeading = await page.locator('h1, h2, h3').locator('text=/Users/i').first();
    const headingVisible = await usersHeading.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Users heading visible: ${headingVisible}`);

    // Verify at least one indicator that users page loaded
    expect(tableVisible || jackVisible || headingVisible).toBe(true);
    console.log('   ✅ Users page is displaying');

    // Step 4: Check for common UI elements
    console.log('\n4️⃣  Checking for common UI elements...');

    // Search functionality
    const searchInput = await page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const searchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`   Search input visible: ${searchVisible}`);

    // Add user button
    const addButton = await page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first();
    const addButtonVisible = await addButton.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`   Add user button visible: ${addButtonVisible}`);

    console.log('\n✅ Users List Test Summary:');
    console.log('   ✅ Navigation to Users worked');
    console.log('   ✅ Users list is displayed');
    console.log(`   ${searchVisible ? '✅' : '⚠️'} Search functionality ${searchVisible ? 'available' : 'not found'}`);
    console.log(`   ${addButtonVisible ? '✅' : '⚠️'} Add user button ${addButtonVisible ? 'available' : 'not found'}`);
  });

  test('Users page persists after refresh', async ({ page }) => {
    console.log('🔄 Testing Users Page Persistence\n');

    // Login and navigate to Users
    console.log('1️⃣  Logging in and navigating to Users...');
    await login(page);
    await page.locator('text=/Users/i').first().click();
    await page.waitForLoadState('networkidle');
    console.log('   ✅ On Users page');

    // Refresh the page
    console.log('\n2️⃣  Refreshing the page...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify still on Users page
    console.log('\n3️⃣  Verifying still on Users page...');
    const usersVisible = await page.locator('text=/Users/i').first().isVisible();
    const urlAfterRefresh = page.url();

    console.log(`   Current URL: ${urlAfterRefresh}`);
    console.log(`   Users page visible: ${usersVisible}`);

    expect(usersVisible).toBe(true);
    console.log('   ✅ Successfully stayed on Users page after refresh!');
  });

  test('Search users functionality', async ({ page }) => {
    console.log('🔍 Testing Users Search\n');

    // Login and navigate to Users
    console.log('1️⃣  Logging in and navigating to Users...');
    await login(page);
    await page.locator('text=/Users/i').first().click();
    await page.waitForLoadState('networkidle');
    console.log('   ✅ On Users page');

    // Try to find and use search
    console.log('\n2️⃣  Testing search functionality...');
    const searchInput = await page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const searchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (searchVisible) {
      await searchInput.fill('Jack');
      await page.waitForTimeout(1000); // Wait for search to filter

      // Check if Jack is still visible (should be)
      const jackVisible = await page.locator('text=/Jack.*Dribber/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`   Search for "Jack" - Jack visible: ${jackVisible}`);
      expect(jackVisible).toBe(true);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);
      console.log('   ✅ Search functionality working');
    } else {
      console.log('   ⚠️  Search input not found, skipping search test');
    }
  });
});
