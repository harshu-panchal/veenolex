import { jest } from "@jest/globals";

// Mock User model
const mockUsers = [];
const mockOrders = [];

const mockUserFindOne = jest.fn((query) => {
  if (query.phone) {
    const found = mockUsers.find(u => u.phone === query.phone);
    return Promise.resolve(found || null);
  }
  return Promise.resolve(null);
});

const mockUserCreate = jest.fn((doc) => {
  const created = {
    _id: "user-" + (mockUsers.length + 1),
    ...doc,
    save: jest.fn(async function() { return this; })
  };
  mockUsers.push(created);
  return Promise.resolve(created);
});

const mockUserFind = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(mockUsers),
}));

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: {
    findOne: mockUserFindOne,
    find: mockUserFind,
    findById: jest.fn((id) => Promise.resolve(mockUsers.find(u => String(u._id) === String(id)) || null)),
    create: mockUserCreate,
  }
}));

const { createAdminPOSCustomer, getCreditCustomers, updateAdminPOSCustomer } = await import("../app/controller/admin/adminPosCreditController.js");

describe("Admin POS Customer Address Management", () => {
  beforeEach(() => {
    mockUsers.length = 0;
    jest.clearAllMocks();
  });

  test("validates required name and phone", async () => {
    const req = { body: { name: "", phone: "" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createAdminPOSCustomer(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/name is required/i) }));

    const req2 = { body: { name: "Rajesh", phone: "" } };
    const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await createAdminPOSCustomer(req2, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/phone is required/i) }));
  });

  test("creates a new POS customer with address", async () => {
    const req = {
      body: {
        name: "Aman Sharma",
        phone: "9876543210",
        address: "Flat 204, Crystal Heights, Indore"
      }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createAdminPOSCustomer(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      customer: expect.objectContaining({
        name: "Aman Sharma",
        phone: "9876543210",
        location: expect.objectContaining({
          address: "Flat 204, Crystal Heights, Indore"
        }),
        addresses: expect.arrayContaining([
          expect.objectContaining({ fullAddress: "Flat 204, Crystal Heights, Indore" })
        ])
      })
    }));
  });

  test("getCreditCustomers returns location and addresses projection", async () => {
    const req = { query: {} };
    const res = { json: jest.fn() };

    await getCreditCustomers(req, res);
    expect(mockUserFind).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      customers: expect.any(Array)
    }));
  });

  test("updates customer phone and address", async () => {
    // First create customer
    const user = {
      _id: "user-100",
      name: "Prathmesh Jawade",
      phone: "06263823004",
      location: { address: "Old Address" },
      addresses: [{ fullAddress: "Old Address" }],
      save: jest.fn(async function() { return this; })
    };
    mockUsers.push(user);

    const req = {
      params: { id: "user-100" },
      body: {
        phone: "916263823004",
        address: "8B Annpurna Nagar, Indore"
      }
    };
    const res = { json: jest.fn() };

    await updateAdminPOSCustomer(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      customer: expect.objectContaining({
        phone: "916263823004",
        location: expect.objectContaining({ address: "8B Annpurna Nagar, Indore" })
      })
    }));
    expect(user.save).toHaveBeenCalled();
  });
});

