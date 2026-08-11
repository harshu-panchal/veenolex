import { test, expect } from '@playwright/test'

/**
 * An unauthenticated visitor must be bounced to the sign-in screen belonging to
 * the portal they aimed at — not to the customer login for all four.
 * Mirrors the branching in src/core/guards/ProtectedRoute.jsx.
 */

const guarded = [
  { name: 'seller dashboard', path: '/seller', redirectsTo: '/seller/auth' },
  { name: 'admin dashboard', path: '/admin', redirectsTo: '/admin/auth' },
  { name: 'delivery dashboard', path: '/delivery/dashboard', redirectsTo: '/delivery/auth' },
  { name: 'customer orders', path: '/orders', redirectsTo: '/login' },
  { name: 'customer checkout', path: '/checkout', redirectsTo: '/login' },
]

for (const route of guarded) {
  test(`${route.name} redirects anonymous visitors to ${route.redirectsTo}`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`${route.redirectsTo}$`), { timeout: 15_000 })
  })
}
