import { test, expect } from '@playwright/test';

test('Comprehensive fixes verification', async ({ page }) => {
  test.setTimeout(120000); // 2 minute timeout

  // Enable logging
  page.on('console', msg => console.log(`[${msg.type().toUpperCase()}]:`, msg.text()));
  page.on('pageerror', error => console.error('[PAGE ERROR]:', error.message));

  console.log('\n=== STEP 1: Login ===');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'mike@gridworx.io');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // ===================================================================
  // TEST 1: Signatures Page - Verify NO placeholder data
  // ===================================================================
  console.log('\n=== TEST 1: Signatures Page (Analytics Tab) ===');
  await page.click('text=Signatures');
  await page.waitForTimeout(1000);

  // Click Analytics tab
  await page.click('button:has-text("Analytics")');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: 'openspec/testing/reports/screenshots/fix-1-signatures-analytics.png',
    fullPage: true
  });

  // Check that placeholder numbers are NOT present
  const has12Campaigns = await page.locator('text="12"').count();
  const has3456Signatures = await page.locator('text="3,456"').count();
  const has985Percent = await page.locator('text="98.5%"').count();
  const hasHolidayCampaign = await page.locator('text="Holiday Campaign"').count();

  console.log(`✓ Checking for removed placeholder data:`);
  console.log(`  - "12" active campaigns: ${has12Campaigns === 0 ? 'REMOVED ✓' : 'STILL PRESENT ✗'}`);
  console.log(`  - "3,456" signatures: ${has3456Signatures === 0 ? 'REMOVED ✓' : 'STILL PRESENT ✗'}`);
  console.log(`  - "98.5%" success rate: ${has985Percent === 0 ? 'REMOVED ✓' : 'STILL PRESENT ✗'}`);
  console.log(`  - "Holiday Campaign": ${hasHolidayCampaign === 0 ? 'REMOVED ✓' : 'STILL PRESENT ✗'}`);

  const hasComingSoon = await page.locator('text=/Analytics.*Coming Soon/i').count();
  console.log(`  - "Coming Soon" message: ${hasComingSoon > 0 ? 'PRESENT ✓' : 'MISSING ✗'}`);

  expect(has12Campaigns).toBe(0);
  expect(has3456Signatures).toBe(0);
  expect(hasComingSoon).toBeGreaterThan(0);

  // ===================================================================
  // TEST 2: Org Chart - Verify better error handling (no JSON parse error)
  // ===================================================================
  console.log('\n=== TEST 2: Org Chart Page ===');
  await page.click('text=Org Chart');
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: 'openspec/testing/reports/screenshots/fix-2-orgchart.png',
    fullPage: true
  });

  // Check for the OLD error message (should NOT be present)
  const hasJsonParseError = await page.locator('text=/JSON.parse.*unexpected character/i').count();
  console.log(`✓ OLD JSON parse error: ${hasJsonParseError === 0 ? 'FIXED ✓' : 'STILL PRESENT ✗'}`);

  // Check for NEW error message (should have helpful message)
  const hasProperError = await page.locator('text=/Unable to Load Organization Chart/i').count();
  const hasErrorDetails = await page.locator('text=/Server.*error|invalid response|migration/i').count();
  console.log(`✓ NEW proper error message: ${hasProperError > 0 ? 'PRESENT ✓' : 'MISSING ✗'}`);
  console.log(`✓ Error details shown: ${hasErrorDetails > 0 ? 'PRESENT ✓' : 'MISSING ✗'}`);

  expect(hasJsonParseError).toBe(0);
  expect(hasProperError).toBeGreaterThan(0);

  // ===================================================================
  // TEST 3: Security Events - Verify fetch works (no "Failed to fetch")
  // ===================================================================
  console.log('\n=== TEST 3: Security Events Page ===');
  await page.click('text=Security Events');
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: 'openspec/testing/reports/screenshots/fix-3-security-events.png',
    fullPage: true
  });

  // Check that the error banner is NOT present
  const hasFailedToFetch = await page.locator('text=/Failed to fetch security events/i').count();
  console.log(`✓ "Failed to fetch" error: ${hasFailedToFetch === 0 ? 'FIXED ✓' : 'STILL PRESENT ✗'}`);

  // Check for empty state or data (either is fine, just not an error)
  const hasEmptyState = await page.locator('text=/No security events/i').count();
  const hasEventsList = await page.locator('.activity-item, .event-item, [class*="event"]').count();
  console.log(`✓ Page state: ${hasEmptyState > 0 ? 'Empty state (OK)' : hasEventsList > 0 ? `${hasEventsList} events shown` : 'Loading or other state'}`);

  expect(hasFailedToFetch).toBe(0);

  // ===================================================================
  // TEST 4: Email Security - Verify GAM reference removed
  // ===================================================================
  console.log('\n=== TEST 4: Email Security Page ===');
  await page.click('text=Email Security');
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: 'openspec/testing/reports/screenshots/fix-4-email-security.png',
    fullPage: true
  });

  // Check that GAM reference is NOT present
  const hasGAM = await page.locator('text=/GAM.*Google Apps Manager/i').count();
  const hasWorkspaceAPI = await page.locator('text=/Google Workspace Admin API/i').count();
  console.log(`✓ GAM reference: ${hasGAM === 0 ? 'REMOVED ✓' : 'STILL PRESENT ✗'}`);
  console.log(`✓ Workspace API reference: ${hasWorkspaceAPI > 0 ? 'PRESENT ✓' : 'MISSING ✗'}`);

  expect(hasGAM).toBe(0);
  expect(hasWorkspaceAPI).toBeGreaterThan(0);

  // ===================================================================
  // TEST 5: Dashboard - Verify real data (from earlier fix)
  // ===================================================================
  console.log('\n=== TEST 5: Dashboard (Bonus check) ===');
  await page.click('text=Home');
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: 'openspec/testing/reports/screenshots/fix-5-dashboard.png',
    fullPage: true
  });

  const metricCards = await page.locator('.metric-card').count();
  console.log(`✓ Dashboard metric cards: ${metricCards} found`);
  expect(metricCards).toBeGreaterThan(0);

  console.log('\n=== ALL TESTS COMPLETE ===');
});
