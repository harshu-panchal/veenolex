import mongoose from "mongoose";
import User from "../../models/customer.js";
import Order from "../../models/order.js";

/**
 * Address of the customer's most recent order that has a usable address.
 * Evaluated inside $project over the already-looked-up `userOrders` array.
 */
const LAST_ORDER_ADDRESS_EXPR = {
  $let: {
    vars: {
      latest: {
        $reduce: {
          input: {
            $filter: {
              input: "$userOrders",
              as: "o",
              cond: {
                $or: [
                  { $gt: [{ $strLenCP: { $ifNull: ["$$o.address.city", ""] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ["$$o.address.address", ""] } }, 0] },
                ],
              },
            },
          },
          initialValue: null,
          in: {
            $cond: [
              {
                $or: [
                  { $eq: ["$$value", null] },
                  { $gt: ["$$this.createdAt", "$$value.createdAt"] },
                ],
              },
              "$$this",
              "$$value",
            ],
          },
        },
      },
    },
    in: {
      $cond: [
        { $eq: ["$$latest", null] },
        null,
        {
          city: "$$latest.address.city",
          address: "$$latest.address.address",
          orderId: "$$latest.orderId",
          at: "$$latest.createdAt",
        },
      ],
    },
  },
};

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Picks the location to show for a customer:
 *   1. last order's delivery address
 *   2. last known app location (captured at login / when the app is opened)
 *   3. first saved address with a city or address
 *   4. location saved on their profile
 */
function resolveCustomerLocation({ lastOrderAddress, lastLoginLocation, profileLocation, savedAddresses }) {
  if (lastOrderAddress && (hasText(lastOrderAddress.city) || hasText(lastOrderAddress.address))) {
    return {
      source: "order",
      city: lastOrderAddress.city || "",
      state: "",
      address: lastOrderAddress.address || "",
      at: lastOrderAddress.at || null,
    };
  }
  const savedAddress = (Array.isArray(savedAddresses) ? savedAddresses : []).find(
    (addr) => hasText(addr?.city) || hasText(addr?.fullAddress),
  );
  for (const [source, loc, at] of [
    ["login", lastLoginLocation, lastLoginLocation?.capturedAt],
    ["address", savedAddress && { ...savedAddress, address: savedAddress.fullAddress }, null],
    ["profile", profileLocation, profileLocation?.updatedAt],
  ]) {
    if (loc && (hasText(loc.city) || hasText(loc.address))) {
      return {
        source,
        city: loc.city || "",
        state: loc.state || "",
        address: loc.address || "",
        at: at || null,
      };
    }
  }
  return null;
}

export async function getUsersData({ page, limit, skip }) {
  const pipeline = [
    { $match: { role: "user" } },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "customer",
        as: "userOrders",
      },
    },
    {
      $project: {
        id: { $toString: "$_id" },
        name: { $ifNull: ["$name", "Unnamed Customer"] },
        email: 1,
        phone: 1,
        joinedDate: "$createdAt",
        status: {
          $cond: [{ $eq: ["$isActive", false] }, "inactive", "active"],
        },
        totalOrders: { $size: "$userOrders" },
        totalSpent: { $sum: "$userOrders.pricing.total" },
        lastOrderDate: { $max: "$userOrders.createdAt" },
        lastOrderAddress: LAST_ORDER_ADDRESS_EXPR,
        lastLoginLocation: 1,
        profileLocation: "$location",
        savedAddresses: "$addresses",
        avatar: {
          $concat: [
            "https://api.dicebear.com/7.x/avataaars/svg?seed=",
            { $ifNull: ["$name", "Customer"] },
          ],
        },
      },
    },
    { $sort: { totalOrders: -1 } },
  ];

  const [result] = await User.aggregate([
    ...pipeline,
    {
      $facet: {
        totalCount: [{ $count: "count" }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ]);

  const total = result?.totalCount?.[0]?.count ?? 0;
  const items = (result?.items ?? []).map(
    ({ lastOrderAddress, lastLoginLocation, profileLocation, savedAddresses, ...item }) => ({
      ...item,
      location: resolveCustomerLocation({ lastOrderAddress, lastLoginLocation, profileLocation, savedAddresses }),
    }),
  );

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getUserByIdData(id) {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
        role: "user",
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "customer",
        as: "userOrders",
      },
    },
    {
      $project: {
        id: { $toString: "$_id" },
        name: { $ifNull: ["$name", "Unnamed Customer"] },
        email: 1,
        phone: 1,
        joinedDate: "$createdAt",
        status: {
          $cond: [{ $eq: ["$isActive", false] }, "inactive", "active"],
        },
        totalOrders: { $size: "$userOrders" },
        totalSpent: { $sum: "$userOrders.pricing.total" },
        lastOrderDate: { $max: "$userOrders.createdAt" },
        avatar: {
          $concat: [
            "https://api.dicebear.com/7.x/avataaars/svg?seed=",
            { $ifNull: ["$name", "Customer"] },
          ],
        },
        addresses: { $ifNull: ["$addresses", []] },
      },
    },
  ]);

  if (!user || user.length === 0) {
    return null;
  }

  const recentOrders = await Order.find({ customer: id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("items.product", "name mainImage");

  const selectedUser = user[0];
  const addresses = Array.isArray(selectedUser.addresses)
    ? selectedUser.addresses
    : [];

  return {
    ...selectedUser,
    addresses,
    recentOrders: recentOrders.map((order) => ({
      id: order.orderId,
      _id: order._id,
      itemsCount: order.items.length,
      amount: order.pricing.total,
      date: order.createdAt,
      status: order.status,
    })),
  };
}
