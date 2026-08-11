# End-to-end tests

Playwright suite covering the four portals (customer, seller, delivery, admin).

## Layout

| Path | What it holds |
| --- | --- |
| `e2e/smoke/` | Read-only checks: page rendering and route guards. Safe against any environment. |
| `e2e/flows/` | Multi-role journeys that create orders and product requests. **Write to the database.** |
| `e2e/support/` | Shared config, API client, and session helpers. |

## Running

```bash
npm run test:e2e            # everything (flows skip unless enabled)
npm run test:e2e:smoke      # read-only checks only, all three browsers
npm run test:e2e:ui         # interactive runner — best way to author new tests
npm run test:e2e:report     # open the HTML report from the last run
```

The config starts `npm run dev` automatically. Set `E2E_BASE_URL` to point at an
already-running app or a deployment, which also disables the managed dev server.

## Running the multi-role flows

The specs in `e2e/flows/` place real orders, accept them, dispatch riders, and
complete deliveries. They are **skipped by default**. Enabling them requires two
things:

1. A database you are willing to write junk into.
2. Credentials for the four roles.

```bash
E2E_ALLOW_MUTATIONS=1 \
E2E_CUSTOMER_PHONE=9999900001 \
E2E_DELIVERY_PHONE=9999900002 \
E2E_SELLER_EMAIL=seller@example.test  E2E_SELLER_PASSWORD=... \
E2E_ADMIN_EMAIL=admin@example.test    E2E_ADMIN_PASSWORD=... \
npm run test:e2e -- --project=flows
```

### Before you enable them

Check what the backend is actually connected to:

```bash
grep -E '^(MONGO_URI|USE_REAL_SMS)=' ../backend/.env
```

Two settings decide whether this is safe:

- **`MONGO_URI`** — if it points at the shared Atlas cluster, every test run adds
  real orders, moves real stock, and writes real wallet entries. Point it at a
  throwaway database first.
- **`USE_REAL_SMS`** — when `true`, login OTPs are random and delivered by SMS,
  so automated login cannot work (and costs money per attempt). Set it to
  `false` in the test environment: `backend/app/utils/otp.js` then returns the
  fixed mock OTP `1234`, which is what `E2E_CUSTOMER_OTP` defaults to.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:5174` | Frontend under test |
| `E2E_API_URL` | `http://localhost:3001/api` | Backend API |
| `E2E_ALLOW_MUTATIONS` | unset | Must be `1` to run `e2e/flows/` |
| `E2E_CUSTOMER_PHONE` / `E2E_CUSTOMER_OTP` | — / `1234` | Customer login |
| `E2E_DELIVERY_PHONE` / `E2E_DELIVERY_OTP` | — / `1234` | Rider login |
| `E2E_SELLER_EMAIL` / `E2E_SELLER_PASSWORD` | — | Seller login |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | — | Admin login |

## How the flow specs are built

State transitions that belong to a role whose screen is not being asserted run
through the REST API (`e2e/support/api.js`), while the user-visible moments run
through the UI. The delivery OTP is read from the **customer's page** and handed
to the rider, so the test proves both portals agree on the same code instead of
trusting one API response twice.

Logins in the flow specs seed the JWT straight into `localStorage`
(`e2e/support/session.js`) rather than replaying the OTP screens — otherwise
every spec would trigger an SMS. The OTP *screens* are still covered by
`e2e/smoke/auth-pages.spec.js`.
