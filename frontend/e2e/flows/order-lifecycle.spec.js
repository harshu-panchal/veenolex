import { test, expect } from '@playwright/test'
import { config, requireMutations, requireAccounts } from '../support/config.js'
import { ApiClient, loginAs, orders, catalog } from '../support/api.js'
import { contextForRole, stubGeolocation } from '../support/session.js'

/**
 * The full customer → seller → delivery order lifecycle.
 *
 *   customer places order
 *     → seller accepts it
 *     → order is broadcast to riders, a rider accepts
 *     → rider confirms pickup
 *     → rider requests the delivery OTP
 *     → customer's order page displays that OTP
 *     → rider enters it, delivery completes
 *
 * State transitions run through the REST API; the assertions that matter to a
 * human — the customer seeing their order and their OTP — run through the UI.
 * The OTP is deliberately read from the *customer's screen* and handed to the
 * rider, so the test proves the two portals agree on the same code rather than
 * trusting one API response twice.
 *
 * Writes to the database. Gated behind E2E_ALLOW_MUTATIONS=1.
 */

test.describe.configure({ mode: 'serial' })

test.describe('Order lifecycle', () => {
  requireMutations(test)
  requireAccounts(test, 'customer', 'seller', 'delivery')

  // Assertions below depend on state built up by earlier steps, so the whole
  // flow shares one browser + one set of tokens.
  let tokens = {}
  let orderId
  let customerPage
  let customerContext

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext()
    for (const role of ['customer', 'seller', 'delivery']) {
      const { token } = await loginAs[role](request, config.accounts[role])
      tokens[role] = token
    }
    await request.dispose()
  })

  test.afterAll(async () => {
    await customerContext?.close()
  })

  test('completes an order from checkout through OTP-verified delivery', async ({
    browser,
    playwright,
  }) => {
    const request = await playwright.request.newContext()
    const customerApi = new ApiClient(request, tokens.customer)
    const sellerApi = new ApiClient(request, tokens.seller)
    const riderApi = new ApiClient(request, tokens.delivery)

    await test.step('customer places a COD order', async () => {
      const products = await catalog.products(customerApi, { limit: 20 })
      const list = products.products || products.items || products
      const product = (Array.isArray(list) ? list : []).find((p) => p?._id)
      expect(product, 'catalog returned no product to order').toBeTruthy()

      const placement = await orders.place(customerApi, {
        items: [{ productId: product._id, quantity: 1, name: product.name }],
        address: {
          type: 'home',
          name: 'E2E Test Customer',
          address: '1 Test Street',
          city: 'Nagpur',
          phone: config.accounts.customer.phone,
          location: { lat: 21.1458, lng: 79.0882 },
        },
        paymentMode: 'COD',
        timeSlot: 'now',
      })

      const placed = placement.order || placement.orders?.[0]
      orderId = placed?._id
      expect(orderId, 'order placement returned no id').toBeTruthy()
    })

    await test.step('customer sees the new order in their orders page', async () => {
      const session = await contextForRole(browser, 'customer', tokens.customer)
      customerContext = session.context
      customerPage = session.page
      await stubGeolocation(customerContext, { latitude: 21.1458, longitude: 79.0882 })

      await customerPage.goto(`${config.baseURL}/orders/${orderId}`, {
        waitUntil: 'domcontentloaded',
      })
      await expect(customerPage.locator('#root')).not.toBeEmpty({ timeout: 20_000 })
    })

    await test.step('seller accepts the order', async () => {
      await orders.setStatus(sellerApi, orderId, { status: 'confirmed' })

      const details = await orders.details(customerApi, orderId)
      const status = String(details.order?.status || details.status || '').toLowerCase()
      expect(status).not.toBe('pending')
    })

    await test.step('order reaches a delivery rider', async () => {
      await orders.broadcast(sellerApi, orderId, {})
      await orders.riderAccept(riderApi, orderId)
    })

    await test.step('rider confirms pickup', async () => {
      await orders.confirmPickup(riderApi, orderId, {})
    })

    let otp

    await test.step('rider requests the delivery OTP', async () => {
      // Riders are normally gated on proximity to the drop point; the radius is
      // controlled by DELIVERY_OTP_RADIUS_METERS on the backend.
      await orders.requestOtp(riderApi, orderId, {
        location: { lat: 21.1458, lng: 79.0882 },
      })
    })

    await test.step('customer app displays the OTP', async () => {
      // DeliveryOtpDisplay renders the code at 48px inside the order page; it
      // arrives over Socket.IO or via the /otp/active fetch on mount.
      await customerPage.reload({ waitUntil: 'domcontentloaded' })

      const otpBlock = customerPage.getByText(/delivery otp/i).first()
      await expect(otpBlock).toBeVisible({ timeout: 30_000 })

      const digits = customerPage.locator('div.font-mono').filter({ hasText: /^\d{4,6}$/ })
      await expect(digits.first()).toBeVisible({ timeout: 30_000 })
      otp = (await digits.first().innerText()).trim()
      expect(otp).toMatch(/^\d{4,6}$/)
    })

    await test.step('rider submits the OTP and the delivery completes', async () => {
      await orders.verifyOtp(riderApi, orderId, {
        otp,
        location: { lat: 21.1458, lng: 79.0882 },
      })

      const details = await orders.details(customerApi, orderId)
      const status = String(details.order?.status || details.status || '').toLowerCase()
      expect(status).toMatch(/deliver/)
    })

    await test.step('customer app confirms the delivery', async () => {
      await customerPage.reload({ waitUntil: 'domcontentloaded' })
      await expect(customerPage.getByText(/delivered|delivery confirmed/i).first()).toBeVisible({
        timeout: 30_000,
      })
    })

    await request.dispose()
  })
})
