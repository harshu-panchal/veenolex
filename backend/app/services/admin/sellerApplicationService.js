import Seller from "../../models/seller.js";
import {
  escapeRegExp,
  formatSellerApplication,
  formatSellerDocuments,
} from "./shared/sellerAdminUtils.js";

export async function getPendingSellerApplications({
  q = "",
  status = "pending",
  page,
  limit,
  skip,
}) {
  const normalizedStatus = String(status || "pending").trim().toLowerCase();
  let baseStatusQuery = { isVerified: { $ne: true } };

  if (normalizedStatus === "pending") {
    baseStatusQuery = {
      isVerified: { $ne: true },
      $or: [
        { applicationStatus: "pending" },
        { applicationStatus: { $exists: false } },
        { applicationStatus: null },
      ],
    };
  } else if (normalizedStatus !== "all") {
    baseStatusQuery = {
      isVerified: { $ne: true },
      applicationStatus: normalizedStatus,
    };
  }

  const conditions = [baseStatusQuery];
  const search = String(q || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    conditions.push({
      $or: [
        { name: regex },
        { shopName: regex },
        { email: regex },
        { phone: regex },
        { address: regex },
      ],
    });
  }

  const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

  const [sellers, total, allPendingForStats] = await Promise.all([
    Seller.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Seller.countDocuments(query),
    Seller.find({
      isVerified: { $ne: true },
      $or: [
        { applicationStatus: "pending" },
        { applicationStatus: { $exists: false } },
      ],
    })
      .select("address documents createdAt")
      .lean(),
  ]);

  const items = sellers.map(formatSellerApplication);
  const totalApplications = allPendingForStats.length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const receivedToday = allPendingForStats.filter(
    (seller) => seller.createdAt && new Date(seller.createdAt) >= todayStart,
  ).length;

  const missingInfo = allPendingForStats.filter((seller) => {
    const docs = formatSellerDocuments(seller.documents);
    return !seller.address || docs.length < 3;
  }).length;

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalApplications,
      receivedToday,
      missingInfo,
      avgReviewTimeHours: 24,
    },
  };
}

export async function approveSellerApplicationById({ sellerId, reviewedBy }) {
  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    {
      $set: {
        isVerified: true,
        isActive: true,
        applicationStatus: "approved",
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: null,
      },
    },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  return formatSellerApplication(seller);
}

export async function rejectSellerApplicationById({
  sellerId,
  reviewedBy,
  reason,
}) {
  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    {
      $set: {
        isVerified: false,
        isActive: false,
        applicationStatus: "rejected",
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: reason || "",
      },
    },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  return formatSellerApplication(seller);
}

/* ===============================
   SELLER PASSWORD RESET APPROVALS
================================ */

function formatPasswordResetRequest(seller) {
  const requestedAt = seller.pendingPasswordReset?.requestedAt
    ? new Date(seller.pendingPasswordReset.requestedAt)
    : null;

  return {
    id: String(seller._id),
    shopName: seller.shopName || "Unnamed Store",
    ownerName: seller.name || "Unnamed Owner",
    email: seller.email || "",
    phone: seller.phone || "",
    status: seller.pendingPasswordReset?.status || "none",
    requestedAt: requestedAt ? requestedAt.toISOString() : null,
    requestedDate: requestedAt
      ? requestedAt.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "",
    requestedTime: requestedAt
      ? requestedAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
  };
}

export async function getPendingPasswordResetRequestList({
  q = "",
  page,
  limit,
  skip,
}) {
  const conditions = [{ "pendingPasswordReset.status": "pending" }];

  const search = String(q || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    conditions.push({
      $or: [
        { name: regex },
        { shopName: regex },
        { email: regex },
        { phone: regex },
      ],
    });
  }

  const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

  const [sellers, total] = await Promise.all([
    Seller.find(query)
      .sort({ "pendingPasswordReset.requestedAt": -1 })
      .skip(skip)
      .limit(limit)
      .select("name shopName email phone pendingPasswordReset")
      .lean(),
    Seller.countDocuments(query),
  ]);

  return {
    items: sellers.map(formatPasswordResetRequest),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function approveSellerPasswordResetById({ sellerId, reviewedBy }) {
  const seller = await Seller.findById(sellerId);

  if (!seller) {
    return { notFound: true };
  }

  if (seller.pendingPasswordReset?.status !== "pending") {
    return { notPending: true };
  }

  await Seller.updateOne(
    { _id: seller._id },
    {
      $set: {
        "pendingPasswordReset.status": "approved",
        "pendingPasswordReset.reviewedAt": new Date(),
        "pendingPasswordReset.reviewedBy": reviewedBy,
      },
      $unset: {
        "pendingPasswordReset.rejectionReason": "",
      },
    },
  );

  const updated = await Seller.findById(sellerId)
    .select("name shopName email phone pendingPasswordReset")
    .lean();

  return { request: formatPasswordResetRequest(updated) };
}

export async function rejectSellerPasswordResetById({
  sellerId,
  reviewedBy,
  reason,
}) {
  const seller = await Seller.findById(sellerId).select("pendingPasswordReset");

  if (!seller) {
    return { notFound: true };
  }

  if (seller.pendingPasswordReset?.status !== "pending") {
    return { notPending: true };
  }

  await Seller.updateOne(
    { _id: seller._id },
    {
      $set: {
        "pendingPasswordReset.status": "rejected",
        "pendingPasswordReset.reviewedAt": new Date(),
        "pendingPasswordReset.reviewedBy": reviewedBy,
        "pendingPasswordReset.rejectionReason":
          String(reason || "").trim() || null,
      },
      // Discard the candidate hash so a rejected password is never retained.
      $unset: { "pendingPasswordReset.requestedPasswordHash": "" },
    },
  );

  const updated = await Seller.findById(sellerId)
    .select("name shopName email phone pendingPasswordReset")
    .lean();

  return { request: formatPasswordResetRequest(updated) };
}
