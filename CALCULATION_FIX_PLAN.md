# Calculation Correctness — Verified State & Implementation Plan

> **STATUS: IMPLEMENTED (2026-10-28).** Every finding below is fixed in the
> working tree. `CR-1` and `CR-2` were not fixed by flipping the two env
> flags — the flags and their legacy branches were **deleted**, so the correct
> behaviour is unconditional and cannot be switched off by a missing env var
> in some environment. Two operational scripts ship with the change and must
> be run (see **Post-deploy actions** at the end).
>
> Verification: 326 backend tests pass (13 new in
> `__tests__/calculation-integrity.test.js`, 2 new in
> `__tests__/finance-order-flow.test.js`, plus 2 pre-existing COD failures
> repaired); the frontend builds clean.

**Date**: 2026-10-28
**Scope**: cart → preview → place order → payment → delivery → settlement → cancel/return → payout
**Method**: code trace + numeric probes executed against `generateOrderPaymentBreakdown` (mocked models, real math).
**Relationship to `PAYMENT_PRICING_AUDIT.md`**: that audit is largely implemented. The fixes for C-1 and C-2
were merged **behind env flags that are not set**, so the buggy legacy paths are the ones running. This
document records what is actually broken *today* and the order to fix it in.

---

## 0. Headline

The pricing engine itself is mostly sound: money is computed in paise (`app/utils/money.js`),
commissions clamp to the line subtotal, handling fee is charged once per checkout, COD advance
splits correctly, and the audit's C-3 (cancellation reversal) and H-1 (`PAYOUT_STATUS.CANCELLED`)
are genuinely fixed.

What is broken is **the boundary between the engine and the money movers**: two merged fixes are
dormant, one refund path never reaches the gateway, and the rider is paid twice on COD.

Proof from probes (fixed delivery ₹30 cfg, 2×₹100 item, 10% commission, platformFee ₹5):

| Probe | Input | Result | Expected |
|---|---|---|---|
| A | `discountTotal: 9999999` | `grandTotal: -9999794` | clamp at 0 / reject |
| B | `walletAmount: 150`, flag off | `grandTotal: 205`, `walletAmount: 0` | `55` |
| B | `walletAmount: 150`, flag on | `grandTotal: 55`, `walletAmount: 150` | `55` ✓ |
| D | `discountTotal: 250` | `grandTotal: -45`, `platformTotalEarning: 5` | clamp 0; earning `5 - 250` |

---

## 1. CRITICAL

### CR-1 — Wallet redemption double-charges the customer (live)
`WALLET_REDEMPTION_REDUCES_PAYABLE` is absent from `backend/.env`, so
`isWalletRedemptionReducesPayableEnabled()` (`app/constants/finance.js:188`) is false,
`walletAllocation` is forced to 0 (`app/services/finance/pricingService.js:613`) and
`applyWalletAllocationToSellerBreakdowns` is a no-op (`app/services/checkoutPricingService.js:448`).

The frontend still shows `grandTotal - walletAmountToUse`
(`frontend/.../pages/CheckoutPage.jsx:342`) and the customer's wallet *is* debited at placement
(`app/services/orderPlacementService.js:635-665`), while `getPayableAmountPaise`
(`app/services/paymentService.js:210`) charges the full `grandTotal`. COD is worse: the rider
collects `getCodCashDue` = `grandTotal − codAdvance`, with no wallet credit.

**Impact**: every wallet-using customer is overcharged by exactly their wallet redemption.

**Fix**
1. Set `WALLET_REDEMPTION_REDUCES_PAYABLE=true` in `backend/.env` and `.env.example`.
2. Change `CheckoutPage.jsx` to read `pricingPreview.payableAmount` instead of subtracting
   `walletAmountToUse` itself, and to send `walletAmount` on the **preview** request too
   (`buildPreviewPayload`, ~L890) so the preview and the order agree.
3. Backfill script: `orders` where `pricing.walletAmount > 0` and
   `financeFlags.onlinePaymentCaptured` / `codMarkedCollected` — credit the over-collected amount
   back to the customer wallet through `walletService.creditWallet` with an idempotency key.
4. Delete the flag and the legacy branch once the backfill is done (keep one release of overlap).

### CR-2 — Client-supplied `discountTotal` is still trusted (live), and the flag alone won't fix it
`SERVER_SIDE_COUPON_ENGINE` is also absent from `.env`, so `buildCheckoutPricingSnapshot` keeps
`effectiveDiscount = round2(discountTotal)` from the request body
(`app/services/checkoutPricingService.js:568-581`). Joi puts no upper bound on it
(`app/validation/financeValidation.js:34`) and `grossTotal` is never clamped at 0
(`app/services/finance/pricingService.js:600`). Probe A reaches `grandTotal = -9,999,794`.

**Worse**: the active checkout **never sends `couponId` or `couponCode`**
(`CheckoutPage.jsx:1071-1077` — only `discountTotal`). So flipping
`SERVER_SIDE_COUPON_ENGINE=true` changes nothing: the engine is gated on
`(couponCode || couponId)` being present. The flag is a no-op until the frontend is changed.

**Fix (all three parts are required, in this order)**
1. `CheckoutPage.jsx`: send `couponId: selectedCoupon?._id` and `couponCode: selectedCoupon?.code`
   on both the preview and the place-order payloads.
2. `pricingService.js:600`: clamp — `grossTotal = Math.max(0, …)`; and in
   `checkoutPricingService.js:637` clamp `sellerDiscount` to that seller's own
   `subtotal + delivery + handling`.
3. Set `SERVER_SIDE_COUPON_ENGINE=true`, then make `discountTotal` ignored unconditionally and
   drop it from the Joi schema (breaking change for any external caller — none found).

### CR-3 — A cancelled ONLINE order never returns money to the customer
`reverseOrderFinanceOnCancellationOnce` (`app/services/finance/orderFinanceService.js:961-1000`)
debits the **admin** wallet, writes a `REFUND` ledger row and sets
`paymentStatus = REFUNDED` — but it never calls the gateway and never credits the customer.
The only gateway refund in the whole backend is `refundCodAdvanceToSource`
(`app/services/paymentService.js:921`, the single `provider.refund(` call site).
Returns, by contrast, do credit the customer wallet
(`app/services/order/orderReturnService.js:486`).

**Impact**: seller-timeout / customer-cancel on a captured ONLINE order = customer's money is kept.
The books say "refunded".

**Fix**: pick the policy, then implement it in that one function.
- *Recommended (matches the return flow)*: credit the customer wallet for
  `grandTotal` via `walletService.creditWallet` inside the same session, with a
  `WALLET_REFUND` ledger row, and keep the admin debit.
- *If money must go back to source*: extract a `refundOrderPaymentToSource(order, amount, reason)`
  in `paymentService.js` that mirrors `refundCodAdvanceToSource` (reuse `Payment.refunds[]`,
  the `refundedAmount` ceiling check and the existing-refund reuse guard), call it from
  `compensateOrderCancellation` **after** commit, and set `REFUNDED` only on gateway acknowledgement.

### CR-4 — The rider is paid twice on every COD order
`handleCodOrderFinanceOnce` nets the rider's earnings out of the cash it tracks —
`codAmountNet = codAmountGross − riderPayoutTotal` (`orderFinanceService.js:654`), i.e. the rider
keeps their commission + tip in cash — and then `settleDeliveredOrderOnce` calls
`createPendingRiderPayout(order)` unconditionally (`orderFinanceService.js:781`) for
`paymentBreakdown.riderPayoutTotal`. `payoutService.js` has no `paymentMode` awareness.
Compare `creditAdminEarning`, which *does* skip COD (`orderFinanceService.js:268`).

**Fix**: in `createPendingRiderPayout`, return `NOT_APPLICABLE` when
`order.paymentMode === "COD"` and `financeFlags.codMarkedCollected` is set (the rider was paid in
cash) — or, cleaner, stop netting in `handleCodOrderFinance` (track gross cash in hand) and keep
the payout as the single compensation channel. Choose one; the second is the better model but
needs a `Wallet.cashInHand` migration. Reconcile existing `PENDING`/`PROCESSING`
`DELIVERY_PARTNER` payouts on COD orders before deploying either.

---

## 2. HIGH

### H-A — Out-of-zone / warehouse shipping is effectively free
`breakdown.deliveryFeeCharged = Σ item.zoneOutPrice` (`checkoutPricingService.js:651`):
`zoneOutPrice` defaults to `null` (`app/models/product.js:206`), the sum **ignores quantity**, and
nothing compares it to the real Shiprocket cost. Since the new
`reassignUnreachableSellerItemsToAdmin` routes any unreachable line to the warehouse, a customer
1000 km away is priced at ₹0 shipping while Shiprocket bills real money.
`productController.js:1309` shows the same `zoneOutPrice || 0` on the PDP, so the quote is at least
self-consistent — just wrong.
**Fix**: multiply by quantity (or make it a per-shipment fee, decide which), make
`zoneOutPrice` required with a non-zero admin default, and add a settings-level
`warehouseShippingBaseFee` floor. Follow-up: use the Shiprocket serviceability/rate API
(`backend/utils/shipRocketService.js`) to quote, cache per pincode.

### H-B — Out-of-zone orders still carry a rider payout
For a routed/out-of-zone order the breakdown keeps `riderPayoutBase/Distance` computed from the
real (huge) distance. No rider is assigned so no payout is created, but on COD that figure is
subtracted from the cash tracked (CR-4's formula) and can exceed the order total → admin tracks ₹0
collected. **Fix**: zero the rider fields when `isOutOfZone` or
`fulfilledBy === "ADMIN"` with warehouse shipping, in the same block at
`checkoutPricingService.js:645-658`.

### H-C — Coupon usage limits are unenforceable
`Coupon.usedCount` is only incremented when `couponId` is present
(`orderPlacementService.js:736`) — and the frontend never sends it (CR-2). `perUserLimit` is
therefore dead, as is the `userUsageCount = 0` short-circuit in `couponController.js:107`.
**Fix**: lands with CR-2 part 1 + flag on; then count real usages from `Order.coupon`
(already persisted at `orderPlacementService.js:531`).

### H-D — Discount cost is never booked
`platformTotalEarning = adminProductCommissionTotal + platformLogisticsMargin`
(`pricingService.js:632`) has no discount term, and `sellerPayoutTotal` is unaffected by the
discount. Probe D: a ₹250 discount leaves `platformTotalEarning` at ₹5. The platform absorbs every
coupon rupee and no report shows it.
**Fix**: add `discountTotal` (and `snapshots.freeDeliveryRebate`) as explicit negative components of
`platformTotalEarning`, and surface a "promotions cost" line in the admin finance summary. Decide
separately whether sellers co-fund seller-scoped coupons.

### H-E — Return refund over-refunds when a coupon was used
`refundAmount = Σ returnItems.price × qty` (`orderReturnService.js:283` and `:466`) uses the
pre-discount line price. A fully returned ₹500 order bought for ₹400 with a coupon refunds ₹500.
**Fix**: refund `lineSubtotal − (lineSubtotal / productSubtotal) × discountTotal` from the frozen
`paymentBreakdown`, capped at the amount actually collected
(`grandTotal − codAdvance refunds already issued`).

### H-F — Return debits the seller more than they were paid
`adjustment = refundAmount + commission` (`orderReturnService.js:557`, `:589`) debits the seller the
**gross** line price, but the seller only ever received `sellerPayout` (gross − admin commission).
The admin keeps the commission on a returned item *and* recovers it from the seller.
**Fix**: debit `lineItems[].sellerPayout` for the returned lines, and reverse the admin commission
separately (debit admin, credit nothing) so the return is value-neutral per party.

### H-G — Per-seller discount split loses paise and isn't clamped
`sellerDiscount = round2(effectiveDiscount * sellerRatio)` (`checkoutPricingService.js:637`) with no
residual correction on the last seller — the sum can differ from the checkout discount by a paise
per seller. It is also unclamped (see CR-2 part 2).
**Fix**: same last-seller-takes-the-remainder pattern already used by
`allocateCheckoutTipToSellerBreakdowns` and `computeCodAdvanceAllocation`.

---

## 3. MEDIUM

| # | Finding | Location | Fix |
|---|---|---|---|
| M-A | `subtractMoney` **adds** its subtrahends (`subtractMoney(100,30) === 130`). Currently unused — a landmine for the next caller. | `app/utils/money.js:27` | `sum - toPaise(value)`, plus a unit test. |
| M-B | `PhonePeAdapter` implements no `refund()` / `getRefundStatus()`. `PAYMENT_PROVIDER=razorpay` today, so refunds work — switching providers silently breaks every refund. | `app/services/payment/providers/phonepe.adapter.js` | Implement both, or make `getActivePaymentProvider()` assert refund capability at boot. |
| M-C | Multi-seller checkout charges **N delivery fees** and **1 handling fee**. Defensible (N riders) but never stated, and the free-delivery rebate then waives all N. | `checkoutPricingService.js:645`, `:380` | Product decision. If one fee is intended, allocate it like the handling fee. |
| M-D | Preview-less fallback `estimatedGrandTotal = cartTotal + tip − discount` omits delivery and handling, so the slider can show less than the charge if the preview request failed. | `CheckoutPage.jsx:341` | Disable the pay slider until a preview resolves. |
| M-E | Client `cartTotal` uses `salePrice` only when `salePrice < price`; the server uses `salePrice \|\| price`. A product with `salePrice > price` is charged above the displayed price. | `CartContext.jsx:276-283` vs `pricingService.js:406-410` | Make the server use the same "lower of the two" rule, and validate `salePrice <= price` on product save. |
| M-F | `taxTotal` is accepted from the client and then hard-forced to `0` (`taxTotal: 0` per seller). Sales GST is never computed or itemised; `GSTReportEntry` is a separate POS *purchase* register. | `checkoutPricingService.js:644`, `financeValidation.js:35` | If prices are GST-inclusive, drop `taxTotal` from the API and state the assumption on the invoice. If not, this is a compliance gap needing an HSN/rate-per-category engine. |
| M-G | `Setting.findOne({})` with no sort — if a second `Setting` document ever exists, pricing becomes nondeterministic. | `financeSettingsService.js:110` | Pin a singleton `_id`, or `sort({ createdAt: 1 })` + a unique guard. |
| M-H | `riderBasePayout` silently falls back to `baseDeliveryCharge`, so an admin who configures only the customer fee gets a zero logistics margin. | `financeSettingsService.js:43-45` | Keep the fallback but warn in the admin UI when `riderBasePayout >= customerBaseDeliveryFee`. |

---

## 4. Implementation plan

### Phase 1 — Stop the bleeding (one PR each, same release)
1. **CR-2 part 2** — clamp `grossTotal` at 0 and clamp `sellerDiscount` per seller. *No flag, no
   behaviour change for honest traffic, kills the negative-total exploit immediately.*
2. **CR-2 part 1** — frontend sends `couponId` + `couponCode` on preview and place-order.
3. **CR-3** — customer actually gets their money back on an ONLINE cancellation (wallet-credit
   variant; it reuses the return flow's proven code path).
4. **CR-4** — stop the second rider payment on COD, plus a reconciliation script for existing
   duplicate payouts.
5. **M-A** — fix `subtractMoney`.

### Phase 2 — Turn the dormant fixes on (needs the backfill first)
6. Backfill script for historical wallet over-charges (CR-1 step 3) — run in report-only mode first.
7. Set `SERVER_SIDE_COUPON_ENGINE=true` → verify discounts, free-delivery and per-user limits on
   staging with the Phase 1 frontend.
8. Set `WALLET_REDEMPTION_REDUCES_PAYABLE=true` → switch `CheckoutPage` to `payableAmount` and send
   `walletAmount` on the preview.
9. Remove both flags and their legacy branches one release later.

### Phase 3 — Revenue integrity
10. **H-A / H-B** — real warehouse shipping pricing + zero rider fields for warehouse orders.
11. **H-D** — book discount and free-delivery cost in `platformTotalEarning` and the admin summary.
12. **H-E / H-F** — discount-aware return refunds and net-of-commission seller debits.
13. **H-G** — residual-correct discount allocation.

### Phase 4 — Hardening
14. **M-B** (provider refund parity), **M-C** (delivery-fee policy decision), **M-D**, **M-E**,
    **M-G**, **M-H**, and the **M-F** GST decision.

### Tests to add (jest, mirroring `__tests__/finance-pricing-flow.test.js` mocking style)
- `discountTotal` larger than the cart ⇒ `grandTotal === 0`, never negative.
- wallet ≥ grandTotal ⇒ `payableAmount === 0`; gateway amount paise `=== 0` ⇒ order is marked paid
  without a gateway round-trip.
- COD + wallet ⇒ `getCodCashDue === grandTotal − advance` with the wallet already deducted.
- COD delivery ⇒ exactly one rider compensation (assert no `DELIVERY_PARTNER` payout row).
- ONLINE cancel after capture ⇒ customer wallet credited `grandTotal`, admin debited, ledger balances.
- Multi-seller: `Σ sellerDiscount === checkout discount` to the paise; `Σ walletAmount === walletUsed`;
  handling fee appears exactly once.
- Partial return with a coupon ⇒ refund `≤` amount collected; seller debited `sellerPayout`, not gross.
- Out-of-zone ⇒ delivery fee `> 0` and rider payout `=== 0`.

### Rollout notes
- Phases 1 and 3 are pure code fixes and need no migration.
- Phase 2 **must not** ship before the backfill, or customers who were overcharged will see the
  corrected math without ever being made whole.
- CR-4 and H-F both move money between existing wallet rows: run
  `app/jobs/walletLedgerVerifierJob.js` (`FINANCE_VERIFIER_ENABLED=true`) in report mode before and
  after each.


---

# IMPLEMENTATION RECORD (2026-10-28)

## What changed, by finding

| Finding | Status | Where |
|---|---|---|
| CR-1 wallet double-charge | Fixed | Flag deleted (`constants/finance.js`); wallet always clamped and subtracted in `pricingService.js`; `applyWalletAllocationToSellerBreakdowns` unconditional; placement always debits via `walletService.debitWallet`; `CheckoutPage` renders `payableAmount` and sends `walletAmount` on the preview |
| CR-2 discount tampering | Fixed | Coupon engine unconditional; `discountTotal`/`taxTotal` stripped in `financeValidation.js`; discount clamped to the chargeable total; `CheckoutPage` sends `couponId`/`couponCode` on both calls |
| CR-3 no refund on ONLINE cancel | Fixed | `reverseOrderFinanceOnCancellationOnce` now credits the customer wallet alongside the admin debit |
| CR-4 rider paid twice on COD | Fixed | `createPendingRiderPayout` returns `NOT_APPLICABLE` for COD; new `financeFlags.riderPaidFromCodCash` |
| H-A free courier shipping | Fixed | `applyWarehouseShippingToBreakdown`: per-unit `zoneOutPrice` × quantity, floored at the new `warehouseShippingBaseFee` setting (default ₹70) |
| H-B phantom rider payout out of zone | Fixed | Rider components zeroed for courier-shipped orders |
| H-C coupon limits unenforceable | Fixed | Falls out of CR-2: `couponId` now reaches the server and `incrementCouponUsage` runs in the order transaction |
| H-D discount cost unbooked | Fixed | `platformTotalEarning` subtracts the applied discount, in `pricingService.js` and `recomputeBreakdownTotals` |
| H-E return over-refund | Fixed | New `computeReturnSettlement` apportions the order discount across returned lines |
| H-F return over-debits seller | Fixed | Seller recovery is the returned lines' `sellerPayout`, not the gross price |
| H-G discount split drift | Fixed | New `allocateProportionally` with last-seller-takes-remainder |
| M-A `subtractMoney` added | Fixed | `app/utils/money.js` |
| M-B provider refund parity | Fixed | `supportsRefunds` capability on the port, `true` on Razorpay, boot warning in the registry |
| M-C N delivery fees | Decided + documented | One fee per seller is intentional (one rider each); documented in `buildCheckoutPricingSnapshot` |
| M-D preview-less estimate | Fixed | Pay slider disabled and labelled "CALCULATING TOTAL…" until a server preview lands |
| M-E salePrice above price | Fixed | `resolveEffectiveUnitPrice` charges the lower of the two; `Product.salePrice` validator rejects the inversion on save |
| M-F GST | Decided + documented | Prices are GST-inclusive; `taxTotal` removed from the API surface |
| M-G non-singleton settings | Fixed | `Setting` reads and the upsert are sorted `createdAt,_id` |
| M-H rider payout ≥ delivery fee | Fixed | Warning logged on settings save |

## Behaviour changes to be aware of

- **`discountTotal` and `taxTotal` in request bodies are now ignored.** They
  are stripped by the Joi schema, so old clients do not 400 — they simply
  stop getting a discount unless they send `couponId`/`couponCode`.
- **`grandTotal` is net of the wallet redemption.** Anything that previously
  subtracted `walletAmount` from `grandTotal` itself must stop. Read
  `payableAmount` (identical to `grandTotal`) or `grossTotal` for the
  pre-wallet figure.
- **`platformTotalEarning` is lower than before** by the order's discount.
  This is the promotions cost finally being recognised, not a revenue drop.
- **COD orders no longer produce a `DELIVERY_PARTNER` payout row.**
  Dashboards that count payouts to infer rider earnings must read
  `paymentBreakdown.riderPayoutTotal` for COD instead.
- **A cancelled ONLINE order credits the customer's wallet**, not their card.
  Same policy as returns. Customers withdraw via the existing payout flow.

## Post-deploy actions (required)

1. `node scripts/backfill-wallet-overcharge.js` — report, review, then
   `--apply`. Credits customers who were charged twice for their wallet.
   Idempotent via the ledger key `WLT-OVERCHARGE-<orderId>`.
2. `node scripts/reconcile-cod-rider-payouts.js` — report, then `--apply` to
   cancel unpaid duplicate rider payouts. Payouts already `COMPLETED` are
   listed for a manual finance decision and never touched.
3. Set `warehouseShippingBaseFee` in admin Fees & Charges to the real average
   Shiprocket cost. It defaults to ₹70; until it is set deliberately,
   nationwide orders are priced on that assumption.
4. Optional: run `walletLedgerVerifierJob` with `FINANCE_VERIFIER_ENABLED=true`
   before and after the two scripts to confirm no ledger drift.

## Not done (needs a product decision, not a code fix)

- **Shiprocket rate quoting.** `warehouseShippingBaseFee` is a flat floor.
  Quoting the courier's actual per-pincode rate (via
  `utils/shipRocketService.js`) and caching it is the real answer, and it
  needs agreement on who absorbs the difference.
- **Seller co-funding of coupons.** Every discount is currently funded
  entirely by the platform (now visible in `platformTotalEarning`). If
  seller-scoped coupons should come out of the seller's payout, that is a new
  rule, not a bug.
- **Admin-side ledger entry on returns.** The return moves money between the
  customer and the seller; the platform's share is recorded in the ledger
  metadata but not posted as an admin wallet debit, because COD orders never
  credit admin earnings at delivery and the debit could drive the admin float
  negative and abort legitimate returns.
