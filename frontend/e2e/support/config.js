/**
 * Central configuration for the E2E suite.
 *
 * Every value is overridable by environment variable so the same specs can run
 * against a local stack, a staging deployment, or CI without code changes.
 */

const asBool = (value) => value === '1' || String(value).toLowerCase() === 'true'

export const config = {
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:5174',
  apiURL: process.env.E2E_API_URL || 'http://localhost:3001/api',

  /**
   * Master switch for specs that create or modify records (orders, product
   * requests, deliveries). Off by default so a careless `npx playwright test`
   * can never write into whatever database the backend happens to point at.
   */
  allowMutations: asBool(process.env.E2E_ALLOW_MUTATIONS),

  accounts: {
    customer: {
      phone: process.env.E2E_CUSTOMER_PHONE || '',
      otp: process.env.E2E_CUSTOMER_OTP || '1234',
    },
    delivery: {
      phone: process.env.E2E_DELIVERY_PHONE || '',
      otp: process.env.E2E_DELIVERY_OTP || '1234',
    },
    seller: {
      email: process.env.E2E_SELLER_EMAIL || '',
      password: process.env.E2E_SELLER_PASSWORD || '',
    },
    admin: {
      email: process.env.E2E_ADMIN_EMAIL || '',
      password: process.env.E2E_ADMIN_PASSWORD || '',
    },
  },
}

/**
 * localStorage keys the app reads its JWTs from.
 * Mirrors src/core/utils/storageKeys.js — keep in sync if those change.
 */
export const AUTH_STORAGE_KEYS = {
  customer: 'auth_customer',
  seller: 'auth_seller',
  admin: 'auth_admin',
  delivery: 'auth_delivery',
}

export const SCHEMA_KEY = 'appzeto:storage_schema_version'
export const SCHEMA_VERSION = '2'

/**
 * Guards a spec that writes to the database. Call inside `test.beforeAll` or at
 * describe level; it turns the whole block into a skip with an explicit reason
 * rather than letting it fail confusingly halfway through a multi-role flow.
 */
export function requireMutations(test) {
  test.skip(
    !config.allowMutations,
    'Write-heavy flow. Set E2E_ALLOW_MUTATIONS=1 against a disposable database to run it.',
  )
}

/**
 * Guards a spec that needs credentials for specific roles.
 */
export function requireAccounts(test, ...roles) {
  for (const role of roles) {
    const account = config.accounts[role]
    const missing = Object.entries(account)
      .filter(([, value]) => !value)
      .map(([field]) => field)
    test.skip(
      missing.length > 0,
      `Missing ${role} credentials: ${missing.map((f) => `E2E_${role.toUpperCase()}_${f.toUpperCase()}`).join(', ')}`,
    )
  }
}
