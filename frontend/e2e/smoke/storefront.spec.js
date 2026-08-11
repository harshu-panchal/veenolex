import { test, expect } from '@playwright/test'

/**
 * Public storefront pages must render for anonymous visitors. Read-only.
 */

test('home page mounts the app shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#root')).toBeAttached()
  // Something must actually paint — an empty root means a crashed bundle.
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 })
})

const publicPages = ['/categories', '/offers', '/about', '/terms', '/privacy']

for (const path of publicPages) {
  test(`${path} renders without a client-side crash`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 })

    expect(errors, `Uncaught errors on ${path}:\n${errors.join('\n')}`).toEqual([])
  })
}
