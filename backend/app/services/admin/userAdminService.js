import mongoose from "mongoose";
import User from "../../models/customer.js";
import Order from "../../models/order.js";
import Wallet from "../../models/wallet.js";
import Cart from "../../models/cart.js";
import Wishlist from "../../models/wishlist.js";
import CreditTransaction from "../../models/creditTransaction.js";

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

function escapeRegex(str) {
  return typeof str === "string" ? str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
}

function resolveDateRange(dateRange, customStart, customEnd) {
  let startDate = customStart ? new Date(customStart) : null;
  let endDate = customEnd ? new Date(customEnd) : null;

  if (dateRange && typeof dateRange === "string") {
    const normalized = dateRange.toLowerCase().trim().replace(/[\s-]+/g, "_");
    const now = new Date();

    if (normalized === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (normalized === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (normalized === "last_7_days" || normalized === "7_days") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (normalized === "last_30_days" || normalized === "30_days") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (normalized === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }
  }

  if (startDate && !isNaN(startDate.getTime())) {
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = null;
  }

  if (endDate && !isNaN(endDate.getTime())) {
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = null;
  }

  return { startDate, endDate };
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

export async function getUsersData({
  page = 1,
  limit = 25,
  skip = 0,
  search = "",
  status = "all",
  dateSort = "",
  sortBy = "",
  startDate = null,
  endDate = null,
  dateRange = "",
  location = "",
}) {
  const initialMatch = { role: "user" };

  if (status && status !== "all") {
    if (status === "active") {
      initialMatch.isActive = { $ne: false };
    } else if (status === "inactive") {
      initialMatch.isActive = false;
    }
  }

  const { startDate: resolvedStart, endDate: resolvedEnd } = resolveDateRange(dateRange, startDate, endDate);
  if (resolvedStart || resolvedEnd) {
    initialMatch.createdAt = {};
    if (resolvedStart) initialMatch.createdAt.$gte = resolvedStart;
    if (resolvedEnd) initialMatch.createdAt.$lte = resolvedEnd;
  }

  if (search && search.trim()) {
    const s = escapeRegex(search.trim());
    initialMatch.$or = [
      { name: { $regex: s, $options: "i" } },
      { email: { $regex: s, $options: "i" } },
      { phone: { $regex: s, $options: "i" } },
    ];
  }

  const pipeline = [
    { $match: initialMatch },
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
        allOrderCities: {
          $map: {
            input: "$userOrders",
            as: "o",
            in: { $ifNull: ["$$o.address.city", ""] },
          },
        },
        allOrderAddresses: {
          $map: {
            input: "$userOrders",
            as: "o",
            in: { $ifNull: ["$$o.address.address", ""] },
          },
        },
        allOrderStates: {
          $map: {
            input: "$userOrders",
            as: "o",
            in: { $ifNull: ["$$o.address.state", ""] },
          },
        },
        recentOrders: {
          $slice: [
            {
              $map: {
                input: "$userOrders",
                as: "o",
                in: {
                  orderId: { $ifNull: ["$$o.orderId", { $toString: "$$o._id" }] },
                  city: { $ifNull: ["$$o.address.city", ""] },
                  address: { $ifNull: ["$$o.address.address", ""] },
                  total: { $ifNull: ["$$o.pricing.total", 0] },
                  createdAt: "$$o.createdAt",
                  status: "$$o.status",
                },
              },
            },
            5,
          ],
        },
        avatar: {
          $concat: [
            "https://api.dicebear.com/7.x/avataaars/svg?seed=",
            { $ifNull: ["$name", "Customer"] },
          ],
        },
      },
    },
  ];

  if (location && location.trim()) {
    const locRegex = new RegExp(escapeRegex(location.trim()), "i");
    pipeline.push({
      $match: {
        $or: [
          { "lastOrderAddress.city": locRegex },
          { "lastOrderAddress.address": locRegex },
          { "lastLoginLocation.city": locRegex },
          { "lastLoginLocation.address": locRegex },
          { "profileLocation.city": locRegex },
          { "profileLocation.address": locRegex },
          { "savedAddresses.city": locRegex },
          { "savedAddresses.fullAddress": locRegex },
          { "savedAddresses.formattedAddress": locRegex },
          { allOrderCities: locRegex },
          { allOrderAddresses: locRegex },
          { allOrderStates: locRegex },
        ],
      },
    });
  }

  let sortStage = { totalOrders: -1, joinedDate: -1 };
  if (dateSort === "asc" || sortBy === "dateAsc") {
    sortStage = { joinedDate: 1 };
  } else if (dateSort === "desc" || sortBy === "dateDesc") {
    sortStage = { joinedDate: -1 };
  } else if (sortBy === "totalOrders") {
    sortStage = { totalOrders: -1, joinedDate: -1 };
  } else if (sortBy === "totalSpent") {
    sortStage = { totalSpent: -1, joinedDate: -1 };
  } else if (sortBy === "lastOrderDate") {
    sortStage = { lastOrderDate: -1, joinedDate: -1 };
  }
  pipeline.push({ $sort: sortStage });

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
    ({ lastOrderAddress, lastLoginLocation, profileLocation, savedAddresses, allOrderCities, allOrderAddresses, ...item }) => {
      let location = resolveCustomerLocation({ lastOrderAddress, lastLoginLocation, profileLocation, savedAddresses });
      if (!location && Array.isArray(allOrderCities) && allOrderCities.some(Boolean)) {
        const firstValidCity = [...allOrderCities].reverse().find(Boolean);
        const firstValidAddr = [...(allOrderAddresses || [])].reverse().find(Boolean);
        location = {
          source: "order",
          city: firstValidCity || "",
          state: "",
          address: firstValidAddr || firstValidCity || "",
          at: item.lastOrderDate || null,
        };
      }
      return {
        ...item,
        location,
        orderCities: Array.isArray(allOrderCities) ? allOrderCities.filter(Boolean) : [],
      };
    },
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

export async function deleteUserData(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const user = await User.findOne({ _id: id, role: "user" });
  if (!user) {
    return null;
  }

  await Promise.allSettled([
    User.findByIdAndDelete(id),
    Wallet.deleteMany({ ownerId: id, ownerType: "CUSTOMER" }),
    Cart.deleteMany({ customerId: id }),
    Wishlist.deleteMany({ customerId: id }),
    CreditTransaction.deleteMany({ customer: id }),
  ]);

  return user;
}
