import mongoose from 'mongoose';
import SellerProductRequest from '../app/models/sellerProductRequest.js';
import { buildAvailableSellerRequestQuery } from '../app/services/orderQueryService.js';
import { WORKFLOW_STATUS } from '../app/constants/orderWorkflow.js';

/**
 * Regression cover for the stale-request bug on the rider dashboard.
 *
 * Riders kept being alerted about seller restock requests they had already
 * declined, and about months-old requests belonging to sellers nowhere near
 * them. Three separate defects fed that:
 *
 *   1. `skippedBy` was missing from the schema, so skipOrder()'s push was
 *      silently discarded by Mongoose strict mode and the skip never stuck.
 *   2. `deliverySearchExpiresAt` was missing too, so the broadcast window
 *      startRequestDeliverySearch() assigns was never persisted and nothing
 *      could age a request out of the pool.
 *   3. The availability query had no seller-proximity constraint, so every
 *      rider saw every pending request regardless of distance.
 */

/* ── A minimal MongoDB query matcher ──────────────────────────────────────
 * Only the operators this query actually uses. Hand-rolled rather than pulled
 * from `sift`, which is present only as a transitive dependency of mongoose
 * and would vanish on an upgrade.
 */

const isOperatorObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const looseEquals = (a, b) => {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a).getTime() === new Date(b).getTime();
  }
  return String(a) === String(b);
};

const containsValue = (actual, candidate) =>
  Array.isArray(actual)
    ? actual.some((entry) => looseEquals(entry, candidate))
    : looseEquals(actual, candidate);

function matchesCondition(actual, condition) {
  if (isOperatorObject(condition)) {
    return Object.entries(condition).every(([operator, operand]) => {
      switch (operator) {
        case '$in':
          return operand.some((candidate) => containsValue(actual, candidate));
        case '$nin':
          return !operand.some((candidate) => containsValue(actual, candidate));
        case '$gt':
          return (
            actual !== null &&
            actual !== undefined &&
            new Date(actual).getTime() > new Date(operand).getTime()
          );
        default:
          throw new Error(`Matcher does not implement ${operator}`);
      }
    });
  }
  // Mongo treats { field: null } as "null or absent".
  if (condition === null) return actual === null || actual === undefined;
  return looseEquals(actual, condition);
}

function matchesQuery(doc, query) {
  return Object.entries(query).every(([field, condition]) => {
    if (field === '$or') {
      return condition.some((branch) => matchesQuery(doc, branch));
    }
    return matchesCondition(doc[field], condition);
  });
}

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const RIDER = new mongoose.Types.ObjectId();
const OTHER_RIDER = new mongoose.Types.ObjectId();
const NEARBY_SELLER = new mongoose.Types.ObjectId();
const DISTANT_SELLER = new mongoose.Types.ObjectId();

const NOW = new Date('2026-08-11T12:00:00.000Z');
const IN_FUTURE = new Date(NOW.getTime() + 45_000);
const IN_PAST = new Date(NOW.getTime() - 45_000);

const query = () =>
  buildAvailableSellerRequestQuery({
    userId: RIDER,
    sellerIds: [NEARBY_SELLER],
    now: NOW,
  });

const request = (overrides = {}) => ({
  deliveryWorkflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
  deliveryBoy: null,
  sellerId: NEARBY_SELLER,
  skippedBy: [],
  deliverySearchExpiresAt: IN_FUTURE,
  updatedAt: NOW,
  ...overrides,
});

/* ── Schema persistence ───────────────────────────────────────────────── */

describe('SellerProductRequest schema', () => {
  it('persists skippedBy so a declined request stays declined', () => {
    const doc = new SellerProductRequest({ sellerId: NEARBY_SELLER });

    doc.skippedBy.push(RIDER);

    expect(doc.toObject().skippedBy.map(String)).toEqual([String(RIDER)]);
  });

  it('persists deliverySearchExpiresAt so the broadcast window survives a save', () => {
    const doc = new SellerProductRequest({ sellerId: NEARBY_SELLER });

    doc.deliverySearchExpiresAt = IN_FUTURE;

    expect(doc.toObject().deliverySearchExpiresAt).toEqual(IN_FUTURE);
  });
});

/* ── Availability rules ───────────────────────────────────────────────── */

describe('buildAvailableSellerRequestQuery', () => {
  it('offers a live request from a nearby seller', () => {
    expect(matchesQuery(request(), query())).toBe(true);
  });

  it('hides a request this rider already skipped', () => {
    expect(matchesQuery(request({ skippedBy: [RIDER] }), query())).toBe(false);
  });

  it('still offers a request another rider skipped', () => {
    expect(matchesQuery(request({ skippedBy: [OTHER_RIDER] }), query())).toBe(true);
  });

  it('hides a request belonging to a seller outside the rider radius', () => {
    expect(matchesQuery(request({ sellerId: DISTANT_SELLER }), query())).toBe(false);
  });

  it('hides a request whose broadcast window has closed', () => {
    expect(matchesQuery(request({ deliverySearchExpiresAt: IN_PAST }), query())).toBe(false);
  });

  it('hides a request already assigned to a rider', () => {
    expect(matchesQuery(request({ deliveryBoy: OTHER_RIDER }), query())).toBe(false);
  });

  it('hides a request that is no longer searching for a rider', () => {
    const assigned = request({
      deliveryWorkflowStatus: WORKFLOW_STATUS.DELIVERY_ASSIGNED,
    });

    expect(matchesQuery(assigned, query())).toBe(false);
  });

  describe('rows written before the expiry field existed', () => {
    it('offers one that was updated within the broadcast window', () => {
      const legacy = request({
        deliverySearchExpiresAt: undefined,
        updatedAt: new Date(NOW.getTime() - 5_000),
      });

      expect(matchesQuery(legacy, query())).toBe(true);
    });

    it('hides a months-old one instead of alerting riders forever', () => {
      const stale = request({
        deliverySearchExpiresAt: undefined,
        updatedAt: new Date('2026-05-02T09:00:00.000Z'),
      });

      expect(matchesQuery(stale, query())).toBe(false);
    });
  });
});
