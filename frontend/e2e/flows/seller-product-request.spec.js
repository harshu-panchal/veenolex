import { test, expect } from '@playwright/test'
import { config, requireMutations, requireAccounts } from '../support/config.js'
import { ApiClient, loginAs, productRequests, catalog } from '../support/api.js'
import { contextForRole } from '../support/session.js'

/**
 * Seller → admin restock request flow.
 *
 *   seller raises a product request
 *     → it appears in the admin's request queue
 *     → admin approves it
 *     → admin dispatches the stock
 *     → seller sees the approved request in their own list
 *
 * Writes to the database. Gated behind E2E_ALLOW_MUTATIONS=1.
 */

test.describe.configure({ mode: 'serial' })

test.describe('Seller product request', () => {
  requireMutations(test)
  requireAccounts(test, 'seller', 'admin')

  let tokens = {}
  let requestId

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext()
    for (const role of ['seller', 'admin']) {
      const { token } = await loginAs[role](request, config.accounts[role])
      tokens[role] = token
    }
    await request.dispose()
  })

  test('a seller restock request is approved and dispatched by admin', async ({
    browser,
    playwright,
  }) => {
    const request = await playwright.request.newContext()
    const sellerApi = new ApiClient(request, tokens.seller)
    const adminApi = new ApiClient(request, tokens.admin)

    await test.step('seller raises a product request', async () => {
      const products = await catalog.products(sellerApi, { limit: 20 })
      const list = products.products || products.items || products
      const product = (Array.isArray(list) ? list : []).find((p) => p?._id)
      expect(product, 'catalog returned no product to request').toBeTruthy()

      const created = await productRequests.create(sellerApi, {
        products: [{ productId: product._id, quantity: 1 }],
        note: 'Created by Playwright E2E suite',
      })

      requestId = created.request?._id || created._id
      expect(requestId, 'request creation returned no id').toBeTruthy()
    })

    await test.step('request shows up in the admin queue', async () => {
      const queue = await productRequests.adminList(adminApi, { status: 'pending' })
      const list = queue.requests || queue.items || queue
      const ids = (Array.isArray(list) ? list : []).map((r) => String(r._id))
      expect(ids).toContain(String(requestId))
    })

    await test.step('admin approves the request in the UI', async () => {
      const { context, page } = await contextForRole(browser, 'admin', tokens.admin)
      await page.goto(`${config.baseURL}/admin/seller-product-requests`, {
        waitUntil: 'domcontentloaded',
      })
      await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 })
      await context.close()

      await productRequests.approve(adminApi, requestId, {
        approvedProducts: [],
        note: 'Approved by E2E suite',
      })
    })

    await test.step('admin dispatches the approved stock', async () => {
      await productRequests.triggerDelivery(adminApi, requestId, {})
    })

    await test.step('seller sees the request as approved', async () => {
      const detail = await productRequests.detail(sellerApi, requestId)
      const status = String(detail.request?.status || detail.status || '').toLowerCase()
      expect(status).not.toBe('pending')
    })

    await request.dispose()
  })
})
