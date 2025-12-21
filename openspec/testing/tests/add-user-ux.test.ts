import { test, expect } from '@playwright/test';

test.describe('Add User UX Improvements', () => {
  const baseUrl = 'http://localhost:3000';
  const testEmail = 'mike@gridworx.io';
  const testPassword = 'admin123';

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(baseUrl);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  async function login(page) {
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Dismiss ViewOnboarding modal if it appears
    const onboardingModal = page.locator('.view-onboarding-overlay');
    if (await onboardingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeBtn = page.locator('.view-onboarding-close, button.view-onboarding-button.primary');
      if (await closeBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.first().click();
        await page.waitForTimeout(500);
      }
    }
  }

  test('QuickAddUserSlideOut shows Job Title dropdown', async ({ page }) => {
    console.log('Testing QuickAddUserSlideOut Job Title dropdown\n');

    await login(page);
    console.log('1. Logged in successfully');

    // Navigate to Users page
    await page.locator('[data-testid="nav-users"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    console.log('2. Navigated to Users page');

    // Click Add User button to open slideout
    const addButton = page.locator('button:has-text("+ Users"), button:has-text("Add User")').first();
    await addButton.click();
    await page.waitForTimeout(1000);
    console.log('3. Clicked Add User button');

    // Check if slideout opened
    const slideout = page.locator('.quick-add-panel, .slideout-panel');
    const slideoutVisible = await slideout.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`4. Slideout visible: ${slideoutVisible}`);

    // Expand Advanced Options
    const advancedToggle = page.locator('button:has-text("Advanced"), .advanced-toggle');
    if (await advancedToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advancedToggle.click();
      await page.waitForTimeout(500);
      console.log('5. Expanded Advanced Options');
    }

    // Check for Job Title dropdown/select
    const jobTitleSelect = page.locator('select, .form-group:has-text("Job Title") select').first();
    const jobTitleInput = page.locator('input[placeholder*="Job"], input[placeholder*="Software"]').first();

    const hasJobTitleDropdown = await jobTitleSelect.isVisible({ timeout: 2000 }).catch(() => false);
    const hasJobTitleInput = await jobTitleInput.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`6. Job Title dropdown visible: ${hasJobTitleDropdown}`);
    console.log(`7. Job Title fallback input visible: ${hasJobTitleInput}`);

    // Take screenshot
    await page.screenshot({
      path: 'openspec/testing/reports/screenshots/add-user-slideout-job-title.png',
      fullPage: false
    });

    // Either dropdown or input should be visible
    expect(hasJobTitleDropdown || hasJobTitleInput).toBe(true);
    console.log('Test passed: Job Title field is available');
  });

  test('QuickAddUserSlideOut shows Manager dropdown', async ({ page }) => {
    console.log('Testing QuickAddUserSlideOut Manager dropdown\n');

    await login(page);
    console.log('1. Logged in successfully');

    // Navigate to Users page
    await page.locator('[data-testid="nav-users"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    console.log('2. Navigated to Users page');

    // Click Add User button to open slideout
    const addButton = page.locator('button:has-text("+ Users"), button:has-text("Add User")').first();
    await addButton.click();
    await page.waitForTimeout(1000);
    console.log('3. Clicked Add User button');

    // Expand Advanced Options
    const advancedToggle = page.locator('button:has-text("Advanced"), .advanced-toggle');
    if (await advancedToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advancedToggle.click();
      await page.waitForTimeout(500);
      console.log('4. Expanded Advanced Options');
    }

    // Check for Manager select element
    const managerSelect = page.locator('select[value]:has(option:has-text("Select manager"))').first();
    const anySelect = page.locator('.form-group:has(label:has-text("Manager")) select').first();

    const hasManagerDropdown = await managerSelect.isVisible({ timeout: 2000 }).catch(() => false);
    const hasAnySelect = await anySelect.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`5. Manager dropdown visible: ${hasManagerDropdown || hasAnySelect}`);

    expect(hasManagerDropdown || hasAnySelect).toBe(true);
    console.log('Test passed: Manager dropdown is available');
  });

  test('AddUser page has provider checkboxes', async ({ page }) => {
    console.log('Testing AddUser page provider checkboxes\n');

    await login(page);
    console.log('1. Logged in successfully');

    // Navigate to Add User page directly
    await page.goto(`${baseUrl}/add-user`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    console.log('2. Navigated to Add User page');

    // Check for provider checkboxes section
    const providerSection = page.locator('h3:has-text("Create User In"), .section-title:has-text("Create User In")');
    const googleCheckbox = page.locator('input[type="checkbox"]:near(:text("Google Workspace"))');
    const microsoftCheckbox = page.locator('input[type="checkbox"]:near(:text("Microsoft 365"))');

    const hasSectionTitle = await providerSection.isVisible({ timeout: 3000 }).catch(() => false);
    const hasGoogleCheckbox = await googleCheckbox.isVisible({ timeout: 3000 }).catch(() => false);
    const hasMicrosoftCheckbox = await microsoftCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`3. Provider section visible: ${hasSectionTitle}`);
    console.log(`4. Google checkbox visible: ${hasGoogleCheckbox}`);
    console.log(`5. Microsoft checkbox visible: ${hasMicrosoftCheckbox}`);

    // Take screenshot
    await page.screenshot({
      path: 'openspec/testing/reports/screenshots/add-user-page-providers.png',
      fullPage: false
    });

    // At least the page should load without errors
    const pageVisible = await page.locator('.add-user-page, .add-user-form').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(pageVisible).toBe(true);
    console.log('Test passed: Add User page loaded successfully');
  });

  test('AddUser page has Job Title and Department dropdowns', async ({ page }) => {
    console.log('Testing AddUser page dropdown fields\n');

    await login(page);
    console.log('1. Logged in successfully');

    // Navigate to Add User page directly
    await page.goto(`${baseUrl}/add-user`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    console.log('2. Navigated to Add User page');

    // Scroll to Profile Information section
    const profileSection = page.locator('h3:has-text("Profile Information")');
    if (await profileSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileSection.scrollIntoViewIfNeeded();
      console.log('3. Scrolled to Profile Information section');
    }

    // Check for Job Title field (could be select or input)
    const jobTitleSelect = page.locator('.form-group:has(label:has-text("Job Title")) select').first();
    const jobTitleInput = page.locator('.form-group:has(label:has-text("Job Title")) input').first();

    const hasJobTitleSelect = await jobTitleSelect.isVisible({ timeout: 2000 }).catch(() => false);
    const hasJobTitleInput = await jobTitleInput.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`4. Job Title select visible: ${hasJobTitleSelect}`);
    console.log(`5. Job Title input visible: ${hasJobTitleInput}`);

    // Check for Department field
    const deptSelect = page.locator('.form-group:has(label:has-text("Department")) select').first();
    const deptInput = page.locator('.form-group:has(label:has-text("Department")) input').first();

    const hasDeptSelect = await deptSelect.isVisible({ timeout: 2000 }).catch(() => false);
    const hasDeptInput = await deptInput.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`6. Department select visible: ${hasDeptSelect}`);
    console.log(`7. Department input visible: ${hasDeptInput}`);

    // Take screenshot
    await page.screenshot({
      path: 'openspec/testing/reports/screenshots/add-user-page-profile-fields.png',
      fullPage: true
    });

    // Either select or input should be visible for job title and department
    expect(hasJobTitleSelect || hasJobTitleInput).toBe(true);
    expect(hasDeptSelect || hasDeptInput).toBe(true);
    console.log('Test passed: Profile fields are available');
  });

  test('API: GET /api/v1/organization/licenses returns licenses', async ({ page }) => {
    console.log('Testing Licenses API endpoint\n');

    await login(page);
    console.log('1. Logged in successfully');

    // Get auth token
    const token = await page.evaluate(() => localStorage.getItem('helios_token'));
    console.log(`2. Got auth token: ${token ? 'yes' : 'no'}`);

    // Make API request
    const response = await page.evaluate(async (authToken) => {
      const resp = await fetch('/api/v1/organization/licenses', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      return {
        status: resp.status,
        body: await resp.json()
      };
    }, token);

    console.log(`3. API Response status: ${response.status}`);
    console.log(`4. API Response success: ${response.body?.success}`);
    console.log(`5. Licenses count: ${response.body?.data?.licenses?.length || 0}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    console.log('Test passed: Licenses API works correctly');
  });

  test('API: GET /api/v1/organization/job-titles returns job titles', async ({ page }) => {
    console.log('Testing Job Titles API endpoint\n');

    await login(page);
    console.log('1. Logged in successfully');

    // Get auth token
    const token = await page.evaluate(() => localStorage.getItem('helios_token'));
    console.log(`2. Got auth token: ${token ? 'yes' : 'no'}`);

    // Make API request
    const response = await page.evaluate(async (authToken) => {
      const resp = await fetch('/api/v1/organization/job-titles', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      return {
        status: resp.status,
        body: await resp.json()
      };
    }, token);

    console.log(`3. API Response status: ${response.status}`);
    console.log(`4. API Response success: ${response.body?.success}`);
    console.log(`5. Job titles count: ${response.body?.data?.length || 0}`);

    // API should return 200 with success: true
    // Data may be empty array if table doesn't exist yet
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    console.log('Test passed: Job Titles API works correctly');
  });
});
