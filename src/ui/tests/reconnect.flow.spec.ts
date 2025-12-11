import { test, expect } from '@playwright/test'

const CONNECTION_STRING = process.env.SERVICEBUS_CONNECTION_STRING

async function ensureConnected(page) {
  // If already connected (green dot visible), return
  const connectedDot = page.locator('text=Dev').first()
  // Heuristic: if namespace indicator shows green dot element with text 'Dev', skip
  // Otherwise, try to add namespace via UI

  if (await connectedDot.count()) {
    return
  }

  // Attempt to connect via "+ Add Namespace" flow if present
  const addNs = page.locator('button:has-text("Add Namespace")')
  if (await addNs.count()) {
    await addNs.click()
    // Try fill in a textarea or input containing connection string
    const ta = page.locator('textarea, input[type="text"], input')
    if (CONNECTION_STRING) {
      await ta.first().fill(CONNECTION_STRING)
      const connectBtn = page.locator('button:has-text("Connect")')
      await connectBtn.first().click()
      // Wait for UI to show connected state heuristically
      await page.waitForTimeout(1000)
    }
  }
}

// Intercept and force a single 401 to simulate expiry
async function forceOne401(page) {
  let fired = false
  await page.route('**/api/**', async (route) => {
    if (!fired) {
      fired = true
      await route.fulfill({ status: 401, body: 'Unauthorized' })
      return
    }
    await route.continue()
  })
}

// Fail the test if any 401 after reconnect success
function failOn401AfterReconnect(page) {
  page.on('response', (resp) => {
    if (resp.status() === 401) {
      throw new Error('401 detected after reconnect')
    }
  })
}

test.describe('Reconnect lifecycle: no 401s after success', () => {
  test('expiry → modal → reconnect → switch entities without 401', async ({ page }) => {
    test.skip(!CONNECTION_STRING, 'SERVICEBUS_CONNECTION_STRING not provided')

    await page.goto('/')
    await ensureConnected(page)

    // Simulate expiry
    // Prefer test hook if available; else force route 401
    const hasHook = await page.evaluate(() => typeof (window as any).__TEST_FORCE_SESSION_EXPIRE === 'function')
    if (hasHook) {
      await page.evaluate(() => (window as any).__TEST_FORCE_SESSION_EXPIRE())
    } else {
      await forceOne401(page)
    }

    // Expect reconnect modal
    const reconnectBtn = page.locator('[data-test="reconnect-cta"], button:has-text("Reconnect")')
    await expect(reconnectBtn).toBeVisible({ timeout: 10_000 })

    failOn401AfterReconnect(page)

    // Click reconnect and provide connection string if prompted
    await reconnectBtn.click()

    const connField = page.locator('textarea, input[type="text"], input').first()
    if (await connField.count()) {
      await connField.fill(CONNECTION_STRING!)
      const go = page.locator('button:has-text("Connect"), button:has-text("Continue")').first()
      if (await go.count()) {
        await go.click()
      }
    }

    // Wait for success toast or green indicator
    await page.waitForTimeout(1000)

    // Switch between entities quickly (queues/topics if visible)
    const leftItems = page.locator('[role="treeitem"], .left-panel .item, .list .item').filter({ hasText: /test-|queue|topic|sub/i })
    const count = await leftItems.count()
    if (count >= 2) {
      await leftItems.nth(0).click()
      await leftItems.nth(1).click()
      await leftItems.nth(0).click()
    }

    // No 401 should have fired after reconnect
    await expect(page.locator('.alert.alert-danger:has-text("Unauthorized")')).toHaveCount(0)
  })
})
