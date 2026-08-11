/**
 * Browser session helpers.
 *
 * The app persists only a raw JWT string per portal in localStorage, so a test
 * can put a role's browser straight into a logged-in state without replaying
 * the OTP screens. That matters here because customer and delivery login are
 * SMS-based: replaying them in every spec would send real messages on any
 * environment where USE_REAL_SMS is enabled.
 */

import { AUTH_STORAGE_KEYS, SCHEMA_KEY, SCHEMA_VERSION } from './config.js'

/**
 * Seeds a JWT so the app boots already authenticated as `role`.
 * Must be called before the first navigation on that page.
 */
export async function seedSession(page, role, token) {
  const storageKey = AUTH_STORAGE_KEYS[role]
  if (!storageKey) throw new Error(`Unknown role "${role}"`)

  await page.addInitScript(
    ([key, value, schemaKey, schemaVersion]) => {
      // Match the current schema version, otherwise the app's migration wipes
      // the token on first load.
      window.localStorage.setItem(schemaKey, schemaVersion)
      window.localStorage.setItem(key, value)
    },
    [storageKey, token, SCHEMA_KEY, SCHEMA_VERSION],
  )
}

/**
 * Opens an isolated browser context already logged in as `role`.
 * Each role needs its own context — the portals share one localStorage origin,
 * so reusing a context would let one role's token clobber another's.
 */
export async function contextForRole(browser, role, token) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await seedSession(page, role, token)
  return { context, page }
}

/** Dismisses the geolocation prompt by pre-granting a fixed position. */
export async function stubGeolocation(context, { latitude, longitude }) {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude, longitude })
}
