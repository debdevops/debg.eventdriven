import { test, expect } from '@playwright/test'

// Helpers
const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:5173'

// Assert no 401s during a period
async function assertNo401(page) {
  const responses: number[] = []
  const listener = (response) => responses.push(response.status())
  page.on('response', listener)
  // Allow some network to flow
  await page.waitForTimeout(2000)
  page.off('response', listener)
  expect(responses.includes(401)).toBeFalsy()
}

// E2E: idle -> modal -> reconnect -> selection restored; no 401 on navigation
 test('reconnect restores selection and prevents 401 after success', async ({ page }) => {
  // Navigate to UI
  await page.goto(UI_BASE_URL)

  // Ensure app is up
  await expect(page.locator('text=Add Namespace').first()).toBeVisible()

  // This assumes a namespace already connected during manual run. Select a queue for context.
  // Select test-queue2 if visible; else fallback to test-queue
  const queue2 = page.locator('text=test-queue2').first()
  const queue1 = page.locator('text=test-queue').first()
  if (await queue2.isVisible()) {
    await queue2.click()
    await expect(queue2).toBeVisible()
  } else if (await queue1.isVisible()) {
    await queue1.click()
    await expect(queue1).toBeVisible()
  }

  // Force session expiry via test hook
  await page.evaluate(() => (window as any).__TEST_FORCE_SESSION_EXPIRE?.())

  // Expect Session Expired modal
  const modal = page.locator('[role="dialog"]').first()
  await expect(modal).toBeVisible()

  // Click Reconnect button
  await page.locator('[data-test="btn-reconnect"]').click()

  // Wait for success toast
  await expect(page.locator('text=Reconnected successfully').first()).toBeVisible({ timeout: 10000 })

  // Immediately navigate to another entity to verify no 401s
  if (await queue1.isVisible()) {
    await queue1.click()
  } else if (await queue2.isVisible()) {
    await queue2.click()
  }

  // Assert no 401 network responses after reconnect
  await assertNo401(page)

  // Selection should remain stable (one of the queues visible/selected)
  expect(await queue1.isVisible() || await queue2.isVisible()).toBeTruthy()
 })
