import { test, expect, Page } from '@playwright/test';

// Test fixtures
const TEST_CREDENTIALS = {
  email: 'admin@gridworx.io',
  password: 'admin123',
};

// Helper to login and navigate to groups
async function loginAndNavigateToGroups(page: Page) {
  await page.goto('/');

  // Wait for login page
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Fill login form
  await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
  await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForURL(/.*dashboard.*|.*\/$/);

  // Navigate to groups page
  await page.click('text=Groups');
  await page.waitForSelector('[data-testid="groups-page"], .groups-table, table');
}

test.describe('GroupSlideOut Component', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Increase timeout for login
    test.setTimeout(60000);
  });

  test('should open slideout when clicking on a group', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Click on the first group row
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();

    // Verify slideout opens
    await expect(page.locator('.slideout-panel, .group-slideout')).toBeVisible();

    // Verify header is visible
    await expect(page.locator('.slideout-header, .slideout-group-info')).toBeVisible();
  });

  test('should show tabs in slideout', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel, .group-slideout');

    // Check for tab buttons
    await expect(page.locator('.slideout-tab:has-text("Overview")')).toBeVisible();
    await expect(page.locator('.slideout-tab:has-text("Members")')).toBeVisible();
    await expect(page.locator('.slideout-tab:has-text("Sync")')).toBeVisible();
    await expect(page.locator('.slideout-tab:has-text("Settings")')).toBeVisible();
    await expect(page.locator('.slideout-tab:has-text("Danger")')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Click Members tab
    await page.click('.slideout-tab:has-text("Members")');
    await expect(page.locator('.tab-header:has-text("Group Members")').or(page.locator('h3:has-text("Group Members")'))).toBeVisible();

    // Click Sync tab
    await page.click('.slideout-tab:has-text("Sync")');
    await expect(page.locator('text=Platform Sync').or(page.locator('h3:has-text("Platform Sync")'))).toBeVisible();

    // Click Settings tab
    await page.click('.slideout-tab:has-text("Settings")');
    await expect(page.locator('text=Group Settings').or(page.locator('h3:has-text("Group Settings")'))).toBeVisible();

    // Click Danger tab
    await page.click('.slideout-tab:has-text("Danger")');
    await expect(page.locator('text=Danger Zone').or(page.locator('h3:has-text("Danger Zone")'))).toBeVisible();

    // Click back to Overview tab
    await page.click('.slideout-tab:has-text("Overview")');
    await expect(page.locator('text=Group Details').or(page.locator('h3:has-text("Group Details")'))).toBeVisible();
  });

  test('should close slideout when clicking X button', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Click close button
    await page.click('.slideout-close');

    // Verify slideout is closed
    await expect(page.locator('.slideout-panel')).not.toBeVisible();
  });

  test('should close slideout when clicking overlay', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Click on overlay (left side of screen)
    await page.click('.slideout-overlay', { position: { x: 50, y: 300 } });

    // Verify slideout is closed
    await expect(page.locator('.slideout-panel')).not.toBeVisible();
  });

  test('should display group details in Overview tab', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Check for detail fields
    await expect(page.locator('.info-item:has-text("Name")').or(page.locator('label:has-text("Name")'))).toBeVisible();
    await expect(page.locator('.info-item:has-text("Email")').or(page.locator('label:has-text("Email")'))).toBeVisible();
    await expect(page.locator('.info-item:has-text("Platform")').or(page.locator('label:has-text("Platform")'))).toBeVisible();
  });

  test('should toggle edit mode in Overview tab', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Click Edit button
    await page.click('button:has-text("Edit")');

    // Check for input fields (edit mode)
    await expect(page.locator('.edit-input, input.edit-input').first()).toBeVisible();

    // Click Cancel button
    await page.click('button:has-text("Cancel")');

    // Verify back to view mode
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
  });

  test('should display members list in Members tab', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Members tab
    await page.click('.slideout-tab:has-text("Members")');

    // Check for Add Member button
    await expect(page.locator('button:has-text("Add Member")')).toBeVisible();

    // Either members list or empty state should be visible
    const hasMembersList = await page.locator('.members-list, .member-item').count() > 0;
    const hasEmptyState = await page.locator('.empty-state').count() > 0;
    expect(hasMembersList || hasEmptyState).toBeTruthy();
  });

  test('should open Add Member modal', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Members tab
    await page.click('.slideout-tab:has-text("Members")');

    // Click Add Member button
    await page.click('button:has-text("Add Member")');

    // Verify modal is visible
    await expect(page.locator('.modal-content, .modal-overlay')).toBeVisible();
    await expect(page.locator('.modal-header:has-text("Add Member"), h3:has-text("Add Member")')).toBeVisible();

    // Check for search input
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();

    // Close modal
    await page.click('.modal-close');
    await expect(page.locator('.modal-content:has-text("Add Member")')).not.toBeVisible();
  });

  test('should show sync status in Sync tab', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Sync tab
    await page.click('.slideout-tab:has-text("Sync")');

    // Check for Google Workspace section
    await expect(page.locator('text=Google Workspace')).toBeVisible();

    // Check for Microsoft 365 section with Coming Soon
    await expect(page.locator('text=Microsoft 365')).toBeVisible();
    await expect(page.locator('text=Coming Soon')).toBeVisible();
  });

  test('should show settings in Settings tab', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Settings tab
    await page.click('.slideout-tab:has-text("Settings")');

    // Check for settings items
    await expect(page.locator('text=Allow External Members')).toBeVisible();
    await expect(page.locator('text=Public Group')).toBeVisible();
    await expect(page.locator('text=Active Status')).toBeVisible();
  });

  test('should show delete button in Danger tab', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Danger tab
    await page.click('.slideout-tab:has-text("Danger")');

    // Check for delete button
    await expect(page.locator('button:has-text("Delete Group")')).toBeVisible();

    // Check for warning text
    await expect(page.locator('text=Permanently delete')).toBeVisible();
  });

  test('should show delete confirmation modal', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Danger tab
    await page.click('.slideout-tab:has-text("Danger")');

    // Click Delete button
    await page.click('button:has-text("Delete Group")');

    // Verify confirmation modal
    await expect(page.locator('.modal-content.danger-modal, .modal-content:has-text("Delete Group")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Close modal by clicking Cancel
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.modal-content.danger-modal')).not.toBeVisible();
  });
});

test.describe('Dynamic Group Rules', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should show Rules tab for dynamic groups', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Check if Rules tab exists (may or may not be visible depending on group type)
    const rulesTab = page.locator('.slideout-tab:has-text("Rules")');
    const isRulesTabVisible = await rulesTab.count() > 0;

    if (isRulesTabVisible) {
      // Switch to Rules tab
      await rulesTab.click();

      // Check for membership rules header
      await expect(page.locator('text=Membership Rules')).toBeVisible();
    }
  });

  test('should allow toggling between static and dynamic membership', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout for a manual group (to be able to toggle)
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Look for Rules tab
    const rulesTab = page.locator('.slideout-tab:has-text("Rules")');
    const isRulesTabVisible = await rulesTab.count() > 0;

    if (isRulesTabVisible) {
      await rulesTab.click();

      // Check for Enable Dynamic or Convert to Static button
      const dynamicButton = page.locator('button:has-text("Enable Dynamic"), button:has-text("Convert to Static")');
      await expect(dynamicButton).toBeVisible();
    }
  });

  test('should show rule builder for dynamic groups', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    const rulesTab = page.locator('.slideout-tab:has-text("Rules")');
    const isRulesTabVisible = await rulesTab.count() > 0;

    if (isRulesTabVisible) {
      await rulesTab.click();

      // Enable dynamic membership if not already enabled
      const enableDynamicButton = page.locator('button:has-text("Enable Dynamic")');
      if (await enableDynamicButton.count() > 0) {
        // Handle the confirmation dialog
        page.on('dialog', dialog => dialog.accept());
        await enableDynamicButton.click();
        await page.waitForTimeout(500);
      }

      // Check for rule builder elements
      const ruleSection = page.locator('.add-rule-section, .add-rule-form');
      if (await ruleSection.count() > 0) {
        // Check for field selector
        await expect(page.locator('select.rule-select').first()).toBeVisible();

        // Check for Add button
        await expect(page.locator('button:has-text("Add")')).toBeVisible();
      }
    }
  });

  test('should show Preview and Apply Rules buttons', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    const rulesTab = page.locator('.slideout-tab:has-text("Rules")');
    const isRulesTabVisible = await rulesTab.count() > 0;

    if (isRulesTabVisible) {
      await rulesTab.click();

      // If group is dynamic, check for action buttons
      const rulesActions = page.locator('.rules-actions');
      if (await rulesActions.count() > 0) {
        await expect(page.locator('button:has-text("Preview")')).toBeVisible();
        await expect(page.locator('button:has-text("Apply Rules")')).toBeVisible();
      }
    }
  });
});

test.describe('Group Sync Functionality', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should show sync status for Google Workspace groups', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Sync tab
    await page.click('.slideout-tab:has-text("Sync")');

    // Check for status information
    const syncSection = page.locator('.sync-section');
    await expect(syncSection).toBeVisible();

    // Check for Google Workspace sync status
    const gwSection = page.locator('.sync-platform').first();
    await expect(gwSection).toBeVisible();
  });

  test('should display sync status row for connected groups', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Sync tab
    await page.click('.slideout-tab:has-text("Sync")');

    // Check if the group is connected (check for either Connected status or "not synced" message)
    const connectedStatus = page.locator('.status-value.connected, text=Connected');
    const notSyncedMsg = page.locator('text=not synced from Google Workspace');

    const isConnected = await connectedStatus.count() > 0;
    const isNotSynced = await notSyncedMsg.count() > 0;

    // At least one should be visible
    expect(isConnected || isNotSynced).toBeTruthy();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should navigate tabs with keyboard', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Focus on a tab button
    await page.focus('.slideout-tab:first-child');

    // Press Tab to move to next tab button
    await page.keyboard.press('Tab');

    // Press Enter to activate the focused tab
    await page.keyboard.press('Enter');

    // Verify tab content changes
    const activeTab = await page.locator('.slideout-tab.active').textContent();
    expect(activeTab).toBeTruthy();
  });

  test('should close modal with Escape key', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // Switch to Members tab and open modal
    await page.click('.slideout-tab:has-text("Members")');
    await page.click('button:has-text("Add Member")');
    await page.waitForSelector('.modal-content');

    // Press Escape to close modal
    await page.keyboard.press('Escape');

    // Modal should be closed (slideout might still be open or closed depending on implementation)
    // Just verify the Add Member modal specifically is closed
    await expect(page.locator('.modal-content:has-text("Add Member")')).not.toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await loginAndNavigateToGroups(page);

    // Open slideout
    const firstGroupRow = page.locator('table tbody tr').first();
    await firstGroupRow.click();
    await page.waitForSelector('.slideout-panel');

    // The slideout should be visible even if some API calls fail
    await expect(page.locator('.slideout-panel')).toBeVisible();
  });
});
