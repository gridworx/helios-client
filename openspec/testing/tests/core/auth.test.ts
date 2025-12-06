import { test, expect } from '@playwright/test'
import { TEST_CONFIG } from '../../helpers/test-helpers'

/**
 * Authentication Test Suite
 *
 * Tests for login, logout, session management, and token handling.
 * Aligned with OpenSpec authentication requirements.
 */
test.describe('Feature: Authentication', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto(TEST_CONFIG.baseUrl)
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test.describe('Requirement: User Login', () => {

    test('Scenario: Valid login with correct credentials', async ({ page }) => {
      // Given: User is on the login page
      await page.goto(TEST_CONFIG.baseUrl)
      await page.waitForLoadState('networkidle')

      const emailInput = page.locator('input[type="email"]').first()
      await emailInput.waitFor({ state: 'visible', timeout: 10000 })

      // When: User enters valid credentials and submits
      await emailInput.fill(TEST_CONFIG.testEmail)
      await page.locator('input[type="password"]').first().fill(TEST_CONFIG.testPassword)

      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login'),
        { timeout: 10000 }
      )

      await page.locator('button[type="submit"]').first().click()

      const loginResponse = await responsePromise
      const responseBody = await loginResponse.json()

      // Then: Login succeeds and user receives tokens
      expect(loginResponse.ok()).toBe(true)
      expect(responseBody.success).toBe(true)
      expect(responseBody.data.tokens.accessToken).toBeTruthy()
      expect(responseBody.data.tokens.refreshToken).toBeTruthy()
      expect(responseBody.data.user.email).toBe(TEST_CONFIG.testEmail)

      // And: User is redirected to dashboard
      await page.waitForLoadState('networkidle')

      // Screenshot for evidence
      await page.screenshot({
        path: 'openspec/testing/reports/screenshots/auth-valid-login-success.png',
        fullPage: true
      })
    })

    test('Scenario: Invalid login with wrong password', async ({ page }) => {
      // Given: User is on the login page
      await page.goto(TEST_CONFIG.baseUrl)
      await page.waitForLoadState('networkidle')

      const emailInput = page.locator('input[type="email"]').first()
      await emailInput.waitFor({ state: 'visible', timeout: 10000 })

      // When: User enters valid email but wrong password
      await emailInput.fill(TEST_CONFIG.testEmail)
      await page.locator('input[type="password"]').first().fill('WrongPassword123!')

      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login'),
        { timeout: 10000 }
      )

      await page.locator('button[type="submit"]').first().click()

      const loginResponse = await responsePromise
      const responseBody = await loginResponse.json()

      // Then: Login fails with appropriate error
      expect(loginResponse.status()).toBe(401)
      expect(responseBody.success).toBe(false)
      expect(responseBody.error).toBe('Invalid email or password')

      // And: User remains on login page
      const emailStillVisible = await emailInput.isVisible()
      expect(emailStillVisible).toBe(true)

      await page.screenshot({
        path: 'openspec/testing/reports/screenshots/auth-invalid-password-error.png',
        fullPage: true
      })
    })

    test('Scenario: Invalid login with non-existent email', async ({ page }) => {
      // Given: User is on the login page
      await page.goto(TEST_CONFIG.baseUrl)
      await page.waitForLoadState('networkidle')

      const emailInput = page.locator('input[type="email"]').first()
      await emailInput.waitFor({ state: 'visible', timeout: 10000 })

      // When: User enters non-existent email
      await emailInput.fill('nonexistent@gridworx.io')
      await page.locator('input[type="password"]').first().fill('SomePassword123!')

      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login'),
        { timeout: 10000 }
      )

      await page.locator('button[type="submit"]').first().click()

      const loginResponse = await responsePromise
      const responseBody = await loginResponse.json()

      // Then: Login fails (same error as wrong password for security)
      expect(loginResponse.status()).toBe(401)
      expect(responseBody.success).toBe(false)
      expect(responseBody.error).toBe('Invalid email or password')
    })
  })

  test.describe('Requirement: Session Management', () => {

    test('Scenario: Session persists after page refresh', async ({ page }) => {
      // Given: User is logged in
      await page.goto(TEST_CONFIG.baseUrl)
      await page.waitForLoadState('networkidle')

      const emailInput = page.locator('input[type="email"]').first()
      await emailInput.waitFor({ state: 'visible', timeout: 10000 })

      await emailInput.fill(TEST_CONFIG.testEmail)
      await page.locator('input[type="password"]').first().fill(TEST_CONFIG.testPassword)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000) // Allow state to settle

      // Verify we're logged in by checking localStorage
      const tokenBefore = await page.evaluate(() => localStorage.getItem('helios_token'))
      expect(tokenBefore).toBeTruthy()

      // When: User refreshes the page
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Then: User remains logged in (token persists)
      const tokenAfter = await page.evaluate(() => localStorage.getItem('helios_token'))
      expect(tokenAfter).toBeTruthy()

      // And localStorage maintained
      await page.screenshot({
        path: 'openspec/testing/reports/screenshots/auth-session-persistence.png',
        fullPage: true
      })
    })

    test('Scenario: Navigation state persists after refresh', async ({ page }) => {
      // Given: User is logged in and on Settings page
      await page.goto(TEST_CONFIG.baseUrl)
      await page.waitForLoadState('networkidle')

      const emailInput = page.locator('input[type="email"]').first()
      await emailInput.waitFor({ state: 'visible', timeout: 10000 })

      await emailInput.fill(TEST_CONFIG.testEmail)
      await page.locator('input[type="password"]').first().fill(TEST_CONFIG.testPassword)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForLoadState('networkidle')

      // Navigate to Settings
      const settingsButton = page.locator('text=/Settings/i').first()
      await settingsButton.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // When: User refreshes the page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Then: User is still on Settings page
      const currentPage = await page.evaluate(() => localStorage.getItem('helios_current_page'))
      expect(currentPage).toBe('settings')

      await page.screenshot({
        path: 'openspec/testing/reports/screenshots/auth-navigation-persistence.png',
        fullPage: true
      })
    })
  })

  test.describe('Requirement: API Authentication', () => {

    test('Scenario: Direct API login returns valid tokens', async ({ request }) => {
      // When: API login is called with valid credentials
      const response = await request.post(`${TEST_CONFIG.apiUrl}/api/auth/login`, {
        data: {
          email: TEST_CONFIG.testEmail,
          password: TEST_CONFIG.testPassword
        }
      })

      const body = await response.json()

      // Then: Response contains valid JWT tokens
      expect(response.ok()).toBe(true)
      expect(body.success).toBe(true)
      expect(body.data.tokens.accessToken).toBeTruthy()
      expect(body.data.tokens.refreshToken).toBeTruthy()
      expect(body.data.user.email).toBe(TEST_CONFIG.testEmail)
      expect(body.data.user.role).toBe('admin')

      // And: Token has correct structure (JWT format)
      const tokenParts = body.data.tokens.accessToken.split('.')
      expect(tokenParts.length).toBe(3) // JWT has 3 parts
    })

    test('Scenario: Token verification succeeds with valid token', async ({ request }) => {
      // Given: User has a valid access token
      const loginResponse = await request.post(`${TEST_CONFIG.apiUrl}/api/auth/login`, {
        data: {
          email: TEST_CONFIG.testEmail,
          password: TEST_CONFIG.testPassword
        }
      })

      const loginBody = await loginResponse.json()
      const accessToken = loginBody.data.tokens.accessToken

      // When: Token is verified
      const verifyResponse = await request.get(`${TEST_CONFIG.apiUrl}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const verifyBody = await verifyResponse.json()

      // Then: Verification succeeds
      expect(verifyResponse.ok()).toBe(true)
      expect(verifyBody.success).toBe(true)
      expect(verifyBody.data.user.email).toBe(TEST_CONFIG.testEmail)
    })

    test('Scenario: Token verification fails with invalid token', async ({ request }) => {
      // When: Invalid token is verified
      const verifyResponse = await request.get(`${TEST_CONFIG.apiUrl}/api/auth/verify`, {
        headers: {
          'Authorization': 'Bearer invalid.token.here'
        }
      })

      const verifyBody = await verifyResponse.json()

      // Then: Verification fails
      expect(verifyResponse.status()).toBe(401)
      expect(verifyBody.success).toBe(false)
    })
  })
})
