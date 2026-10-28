import mongoose from 'mongoose';
import SellerProductRequest from '../app/models/sellerProductRequest.js';
import { isRequestReadyForSellerStock } from '../app/services/sellerRequestFulfillmentService.js';

/**
 * Regression cover for requested products appearing in /seller/products
 * before they were ever delivered.
 *
 * Approving a seller product request used to clone the admin product into the
 * seller's catalogue and credit SellerInventory straight away. The seller saw
 * stock they did not have yet: admin had only approved the request and picked
 * a rider, nobody had handed anything over, and on a PAY_AFTER_DELIVERY
 * request no money had changed hands either.
 *
 * The rule now: a request's goods reach the seller's catalogue only once the
 * rider's 4-digit handover PIN has been validated (status DELIVERED) AND the
 * bill is settled (paymentStatus PAID). `isRequestReadyForSellerStock` is that
 * gate, and the schema fields below are what make the two-step movement — out
 * of the warehouse at approval, into the seller's catalogue at delivery —
 * survive a save.
 */

const requestAt = (overrides) => ({
  status: 'PENDING',
  deliveryWorkflowStatus: null,
  paymentStatus: 'PENDING',
  paymentType: 'PAY_AFTER_DELIVERY',
  ...overrides,
});

describe('seller request stock gate', () => {
  it('holds stock while the request is only approved', () => {
    expect(
      isRequestReadyForSellerStock(requestAt({ status: 'APPROVED' })),
    ).toBe(false);
  });

  it('holds stock once a rider is assigned but has delivered nothing', () => {
    expect(
      isRequestReadyForSellerStock(
        requestAt({
          status: 'APPROVED',
          deliveryWorkflowStatus: 'DELIVERY_ASSIGNED',
        }),
      ),
    ).toBe(false);
  });

  it('holds stock while the goods are out for delivery', () => {
    expect(
      isRequestReadyForSellerStock(
        requestAt({
          status: 'APPROVED',
          deliveryWorkflowStatus: 'OUT_FOR_DELIVERY',
        }),
      ),
    ).toBe(false);
  });

  it('holds stock when delivered but the bill is unsettled', () => {
    expect(
      isRequestReadyForSellerStock(
        requestAt({
          status: 'DELIVERED',
          deliveryWorkflowStatus: 'DELIVERED',
          paymentStatus: 'PENDING',
        }),
      ),
    ).toBe(false);
  });

  it('holds stock when paid up front but not yet delivered', () => {
    expect(
      isRequestReadyForSellerStock(
        requestAt({
          status: 'APPROVED',
          paymentType: 'PAY_NOW',
          paymentStatus: 'PAID',
        }),
      ),
    ).toBe(false);
  });

  it('releases stock only once delivered and paid', () => {
    expect(
      isRequestReadyForSellerStock(
        requestAt({
          status: 'DELIVERED',
          deliveryWorkflowStatus: 'DELIVERED',
          paymentStatus: 'PAID',
        }),
      ),
    ).toBe(true);
  });

  it('refuses a missing request rather than treating it as ready', () => {
    expect(isRequestReadyForSellerStock(null)).toBe(false);
    expect(isRequestReadyForSellerStock(undefined)).toBe(false);
  });
});

describe('seller request stock-movement fields persist', () => {
  // Without these declared, Mongoose strict mode drops them on save and the
  // idempotency markers silently do nothing — the same class of bug that let
  // skipped rider broadcasts reappear.
  const paths = [
    'warehouseStockReservedAt',
    'stockMaterializedAt',
    'assignedAt',
    'collectedAmount',
    'collectedBy',
    'collectedAt',
  ];

  it.each(paths)('declares %s on the schema', (path) => {
    expect(SellerProductRequest.schema.path(path)).toBeDefined();
  });

  it('keeps the markers through a save round-trip', () => {
    const now = new Date();
    const doc = new SellerProductRequest({
      sellerId: new mongoose.Types.ObjectId(),
      sellerName: 'Test Seller',
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productName: 'Widget',
          pricePerUnit: 100,
          quantity: 2,
          totalPrice: 200,
        },
      ],
      subtotal: 200,
      totalAmount: 200,
      paymentType: 'PAY_AFTER_DELIVERY',
      warehouseStockReservedAt: now,
      stockMaterializedAt: now,
      assignedAt: now,
      collectedAmount: 200,
      collectedAt: now,
    });

    const plain = doc.toObject();
    expect(plain.warehouseStockReservedAt).toEqual(now);
    expect(plain.stockMaterializedAt).toEqual(now);
    expect(plain.assignedAt).toEqual(now);
    expect(plain.collectedAmount).toBe(200);
    expect(plain.collectedAt).toEqual(now);
  });
});
