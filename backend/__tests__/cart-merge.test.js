import { jest } from "@jest/globals";

// Mock Cart and Product models
const mockCarts = [];
const mockProducts = [
  { _id: "prod-1", name: "Product 1", status: "active", isApproved: true, price: 100 },
  { _id: "prod-2", name: "Product 2", status: "active", isApproved: true, price: 200 },
  { _id: "prod-3", name: "Inactive Product", status: "inactive", isApproved: true, price: 50 },
];

function createCartDoc(data) {
  const doc = {
    _id: data._id || "cart-" + (mockCarts.length + 1),
    customerId: data.customerId,
    items: data.items ? [...data.items] : [],
    save: jest.fn(async function () {
      return this;
    }),
  };
  return doc;
}

const mockCartFindOne = jest.fn((query) => {
  const found = mockCarts.find(c => String(c.customerId) === String(query.customerId));
  return Promise.resolve(found || null);
});

const mockCartFindById = jest.fn((id) => {
  const found = mockCarts.find(c => String(c._id) === String(id));
  return {
    populate: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(found ? {
        _id: found._id,
        customerId: found.customerId,
        items: found.items.map(item => ({
          ...item,
          productId: mockProducts.find(p => String(p._id) === String(item.productId)) || null,
        })),
      } : null),
    }),
  };
});

class MockCart {
  constructor(data) {
    const doc = createCartDoc(data);
    mockCarts.push(doc);
    return doc;
  }
}
MockCart.findOne = mockCartFindOne;
MockCart.findById = mockCartFindById;
MockCart.create = jest.fn(async (data) => {
  const doc = createCartDoc(data);
  mockCarts.push(doc);
  return doc;
});

const mockProductFindOne = jest.fn((query) => {
  const prod = mockProducts.find(p => String(p._id) === String(query._id) && p.status === "active");
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(prod ? { _id: prod._id } : null),
    }),
  };
});

jest.unstable_mockModule("../app/models/cart.js", () => ({
  default: MockCart,
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    findOne: mockProductFindOne,
  },
}));

const { mergeCart } = await import("../app/controller/cartController.js");

describe("Cart Merge on Login", () => {
  beforeEach(() => {
    mockCarts.length = 0;
    jest.clearAllMocks();
  });

  test("creates a new cart and adds guest items if user has no prior cart", async () => {
    const req = {
      user: { id: "cust-1" },
      body: {
        items: [
          { productId: "prod-1", quantity: 2, variantSku: "" },
          { productId: "prod-2", quantity: 1, variantSku: "RED" },
        ],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await mergeCart(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.result.items).toHaveLength(2);
    expect(result.result.items[0].quantity).toBe(2);
    expect(result.result.items[1].quantity).toBe(1);
    expect(result.result.items[1].variantSku).toBe("RED");
  });

  test("merges guest items into existing cart without duplicating line items", async () => {
    // Existing cart in DB for user
    const existing = createCartDoc({
      customerId: "cust-2",
      items: [
        { productId: "prod-1", quantity: 1, variantSku: "" },
      ],
    });
    mockCarts.push(existing);

    const req = {
      user: { id: "cust-2" },
      body: {
        items: [
          { productId: "prod-1", quantity: 1, variantSku: "" }, // Same item, should remain qty: 1 (not duplicated)
          { productId: "prod-2", quantity: 1, variantSku: "" },  // New item
        ],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await mergeCart(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    // Must be exactly 2 items, NOT 3
    expect(result.result.items).toHaveLength(2);

    const prod1Line = result.result.items.find(i => String(i.productId._id) === "prod-1");
    expect(prod1Line.quantity).toBe(1);

    const prod2Line = result.result.items.find(i => String(i.productId._id) === "prod-2");
    expect(prod2Line.quantity).toBe(1);
  });

  test("repeated merge calls with identical items never create duplicate line items", async () => {
    const req = {
      user: { id: "cust-double" },
      body: {
        items: [
          { productId: "prod-1", quantity: 1, variantSku: "LOTION 300ML" },
          { productId: "prod-2", quantity: 1, variantSku: "JUICE 500ML" },
        ],
      },
    };
    const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    // Call 1
    await mergeCart(req, res1);
    // Call 2 (simulating React StrictMode or double-execution)
    await mergeCart(req, res2);

    const finalResult = res2.json.mock.calls[0][0];
    expect(finalResult.success).toBe(true);
    // Must be exactly 2 items, NEVER doubled to 4
    expect(finalResult.result.items).toHaveLength(2);
    expect(finalResult.result.items[0].quantity).toBe(1);
    expect(finalResult.result.items[1].quantity).toBe(1);
  });

  test("automatically consolidates legacy duplicate lines in user cart", async () => {
    // User already has legacy duplicated rows in MongoDB
    const duplicateCart = createCartDoc({
      customerId: "cust-legacy",
      items: [
        { productId: "prod-1", quantity: 1, variantSku: "LOTION 300ML" },
        { productId: "prod-1", quantity: 1, variantSku: "LOTION 300ML" }, // duplicate line
        { productId: "prod-2", quantity: 1, variantSku: "" },
        { productId: "prod-2", quantity: 1, variantSku: "" }, // duplicate line
      ],
    });
    mockCarts.push(duplicateCart);

    const req = {
      user: { id: "cust-legacy" },
      body: {
        items: [
          { productId: "prod-1", quantity: 1, variantSku: "LOTION 300ML" },
          { productId: "prod-2", quantity: 1, variantSku: "" },
        ],
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await mergeCart(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    // Must be consolidated to exactly 2 items
    expect(result.result.items).toHaveLength(2);
  });

  test("skips inactive or invalid products during merge", async () => {
    const req = {
      user: { id: "cust-3" },
      body: {
        items: [
          { productId: "prod-3", quantity: 1, variantSku: "" }, // Inactive product
          { productId: "prod-nonexistent", quantity: 1, variantSku: "" },
          { productId: "prod-1", quantity: 1, variantSku: "" }, // Valid product
        ],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await mergeCart(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.result.items).toHaveLength(1);
    expect(String(result.result.items[0].productId._id)).toBe("prod-1");
  });
});
