import { test, expect } from '@playwright/test'

/**
 * Every portal's sign-in screen must render its own credential fields.
 * These are read-only: they stop short of submitting, so nothing reaches the
 * database and no OTP SMS is sent.
 */

const portals = [
  {
    role: 'customer',
    path: '/login',
    fields: ['input[name="phone"]'],
  },
  {
    role: 'seller',
    path: '/seller/auth',
    fields: ['input[name="email"]', 'input[name="password"]'],
  },
  {
    role: 'admin',
    path: '/admin/auth',
    fields: ['input[name="email"]', 'input[name="password"]'],
  },
  {
    role: 'delivery',
    path: '/delivery/auth',
    fields: ['input[type="tel"]'],
  },
]

for (const portal of portals) {
  test(`${portal.role} sign-in page renders its credential fields`, async ({ page }) => {
    await page.goto(portal.path, { waitUntil: 'domcontentloaded' })

    for (const selector of portal.fields) {
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 15_000 })
    }
  })
}
