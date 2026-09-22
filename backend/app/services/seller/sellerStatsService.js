/**
 * SellerStatsService
 *
 * Cache-fronted reader for the seller dashboard stats payload that previously
 * lived inline inside `sellerStatsController.getSellerStats`.
 *
 * Refactor P6.2 — extends the existing cache coverage pattern (already used
 * by `delivery/deliveryEarningsService.js`) to the seller dashboard, which
 * the controller currently re-computes on every request via a single big
 * `$facet` aggregation plus a category pipeline.
 *
 * Cache TTL is short (default ~60s — `sellerStats` in cacheService) so any
 * data drift from order/product writes is bounded. Write-side invalidations
 * are not yet wired — the short TTL handles staleness conservatively.
 *
 * Inputs:
 *   sellerId — string (Mongo ObjectId hex), normalised internally.
 *   range    — "daily" | "weekly" | "monthly" (controls trend buckets).
 *   from/to  — optional YYYY-MM-DD (IST) bounds. When given, every figure is
 *              scoped to that window (clamped to the 40-day seller lock) and
 *              the payload also carries `daySummary` and `orders`.
 *
 * Output shape is **byte-for-byte identical** to the legacy controller
 * response so existing frontend consumers see no change.
 */

import mongoose from "mongoose";

import Order from "../../models/order.js";
import Product from "../../models/product.js";
import { buildKey, getOrSet, getTTL } from "../cacheService.js";
import {
  IST_OFFSET,
  DAY_MS,
  getIstDateRange,
  toIstDateString,
} from "../../utils/istDateRange.js";

// Sellers may only look back this many days (including today).
const SELLER_LOCK_DAYS = 40;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const SOURCE_COLORS = {
  Direct: "#3b82f6",
  Search: "#10b981",
  Social: "#f59e0b",
  Referral: "#8b5cf6",
};

function svcErr(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toSellerOid(rawId) {
  if (rawId == null) {
    throw svcErr("Unauthorized", 401);
  }
  if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw svcErr("Invalid user id", 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

function normalizeRange(value) {
  const v = String(value || "daily").toLowerCase();
  if (v === "monthly" || v === "weekly" || v === "daily") return v;
  return "daily";
}

/**
 * Public read API. Cached for ~60s (`sellerStats` TTL) — absorbs dashboard
 * polling without amplifying the underlying $facet aggregation.
 */
export async function getSellerStats(sellerId, { range = "daily", from, to } = {}) {
  const sellerOid = toSellerOid(sellerId);
  const normRange = normalizeRange(range);
  const dayRange = resolveSellerDateRange(from, to);
  const cacheKey = buildKey(
    "seller",
    "stats",
    `${sellerOid.toString()}:${normRange}${dayRange ? `:${dayRange.from}:${dayRange.to}` : ""}`,
  );
  return getOrSet(
    cacheKey,
    () => computeSellerStats(sellerOid, normRange, dayRange),
    getTTL("sellerStats"),
  );
}

/**
 * Resolves from/to into an IST range kept inside the seller's 40-day window
 * (lock start → today). The requested range is clamped to that window; a
 * range entirely outside it is rejected rather than silently shifted.
 */
function resolveSellerDateRange(from, to) {
  const range = getIstDateRange(from, to);
  if (!range) return null;
  const lockFrom = toIstDateString(new Date(Date.now() - (SELLER_LOCK_DAYS - 1) * DAY_MS));
  const today = toIstDateString(new Date());
  const clampedFrom = range.from < lockFrom ? lockFrom : range.from;
  const clampedTo = range.to > today ? today : range.to;
  if (clampedFrom > clampedTo) {
    throw svcErr(`Sellers can only view data from the last ${SELLER_LOCK_DAYS} days`, 400);
  }
  return getIstDateRange(clampedFrom, clampedTo);
}

function formatHourLabel(h) {
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${h < 12 ? "AM" : "PM"}`;
}

async function computeSellerStats(sellerOid, range, dayRange = null) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const trendStartDate = new Date();
  let aggregationFormat = "%Y-%m-%d";
  if (range === "monthly") {
    trendStartDate.setMonth(trendStartDate.getMonth() - 6);
    aggregationFormat = "%Y-%m";
  } else if (range === "weekly") {
    trendStartDate.setDate(trendStartDate.getDate() - 28);
    aggregationFormat = "%Y-%U";
  } else {
    trendStartDate.setDate(trendStartDate.getDate() - 40);
  }

  // 40 days data lock for Sellers
  const fortyDaysAgo = new Date();
  fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

  const windowMatch = dayRange
    ? { $gte: dayRange.start, $lt: dayRange.end }
    : { $gte: fortyDaysAgo };

  let salesTrendPipeline;
  if (dayRange?.days === 1) {
    salesTrendPipeline = [
      {
        $group: {
          _id: { $hour: { date: "$createdAt", timezone: IST_OFFSET } },
          sales: { $sum: { $ifNull: ["$pricing.total", 0] } },
          orders: { $sum: 1 },
        },
      },
    ];
  } else if (dayRange) {
    salesTrendPipeline = [
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: IST_OFFSET } },
          sales: { $sum: { $ifNull: ["$pricing.total", 0] } },
          orders: { $sum: 1 },
        },
      },
    ];
  } else {
    salesTrendPipeline = [
      { $match: { createdAt: { $gte: trendStartDate } } },
      {
        $group: {
          _id: { $dateToString: { format: aggregationFormat, date: "$createdAt", timezone: IST_OFFSET } },
          sales: { $sum: { $ifNull: ["$pricing.total", 0] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
  }

  const [statsResult] = await Order.aggregate([
    {
      $match: {
        seller: sellerOid,
        status: { $ne: "cancelled" },
        createdAt: windowMatch,
      },
    },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalSales: { $sum: { $ifNull: ["$pricing.total", 0] } },
              totalOrders: { $sum: 1 },
            },
          },
        ],
        currentWeek: [
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: null,
              sales: { $sum: { $ifNull: ["$pricing.total", 0] } },
              count: { $sum: 1 },
            },
          },
        ],
        prevWeek: [
          { $match: { createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
          {
            $group: {
              _id: null,
              sales: { $sum: { $ifNull: ["$pricing.total", 0] } },
              count: { $sum: 1 },
            },
          },
        ],
        salesTrend: salesTrendPipeline,
        topCities: [
          { $group: { _id: "$address.city", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ],
        peakHours: [
          { $project: { hour: { $hour: { date: "$createdAt", timezone: IST_OFFSET } } } },
          { $group: { _id: "$hour", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ],
        topProductsCurrent: [
          ...(dayRange ? [] : [{ $match: { createdAt: { $gte: sevenDaysAgo } } }]),
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.product",
              name: { $first: "$items.name" },
              sales: { $sum: "$items.quantity" },
              revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            },
          },
          { $sort: { sales: -1 } },
          { $limit: 10 },
        ],
        topProductsPrev: [
          { $match: { createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.product",
              sales: { $sum: "$items.quantity" },
            },
          },
        ],
        trafficSources: [
          { $group: { _id: "$trafficSource", value: { $sum: 1 } } },
          { $project: { name: "$_id", value: 1, _id: 0 } },
        ],
        devices: [
          { $group: { _id: "$deviceType", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
      },
    },
  ]);

  const overviewRaw = statsResult.overview[0] || { totalSales: 0, totalOrders: 0 };
  const totalSales = overviewRaw.totalSales;
  const totalOrders = overviewRaw.totalOrders;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const currentSales = statsResult.currentWeek[0]?.sales || 0;
  const prevSalesVal = statsResult.prevWeek[0]?.sales || 0;
  const salesTrendPerc =
    prevSalesVal === 0
      ? currentSales > 0
        ? 100
        : 0
      : (((currentSales - prevSalesVal) / prevSalesVal) * 100).toFixed(1);

  const currentOrdersCount = statsResult.currentWeek[0]?.count || 0;
  const prevOrdersCount = statsResult.prevWeek[0]?.count || 0;
  const ordersTrendPerc =
    prevOrdersCount === 0
      ? currentOrdersCount > 0
        ? 100
        : 0
      : (((currentOrdersCount - prevOrdersCount) / prevOrdersCount) * 100).toFixed(1);

  const salesTrend = statsResult.salesTrend;
  let chartData = [];
  if (dayRange?.days === 1) {
    for (let h = 0; h < 24; h++) {
      const data = salesTrend.find((item) => item._id === h);
      chartData.push({
        _id: h,
        date: dayRange.from,
        name: formatHourLabel(h),
        sales: data ? data.sales : 0,
        orders: data ? data.orders : 0,
        traffic: 0,
      });
    }
  } else if (dayRange) {
    for (let i = 0; i < dayRange.days; i++) {
      const d = new Date(dayRange.start.getTime() + i * DAY_MS);
      const dateStr = toIstDateString(d);
      const data = salesTrend.find((item) => item._id === dateStr);
      chartData.push({
        _id: dateStr,
        date: dateStr,
        name: `${Number(dateStr.slice(8, 10))} ${MONTH_NAMES[Number(dateStr.slice(5, 7)) - 1]}`,
        sales: data ? data.sales : 0,
        orders: data ? data.orders : 0,
        traffic: 0,
      });
    }
  } else if (range === "monthly") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const dateStr = d.toISOString().slice(0, 7);
      const data = salesTrend.find((item) => item._id === dateStr);
      chartData.push({
        _id: dateStr,
        date: dateStr,
        name: MONTH_NAMES[d.getMonth()],
        sales: data ? data.sales : 0,
        orders: data ? data.orders : 0,
        traffic: 0,
      });
    }
  } else if (range === "weekly") {
    chartData = salesTrend
      .map((item, idx) => ({
        _id: item._id,
        date: item._id,
        name: `Week ${idx + 1}`,
        sales: item.sales,
        orders: item.orders,
        traffic: 0,
      }))
      .slice(-4);
  } else {
    for (let i = 39; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const data = salesTrend.find((item) => item._id === dateStr);
      chartData.push({
        _id: dateStr,
        date: dateStr,
        name: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
        sales: data ? data.sales : 0,
        orders: data ? data.orders : 0,
        traffic: 0,
      });
    }
  }

  const categoryData = await Product.aggregate([
    { $match: { sellerId: sellerOid } },
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category.name",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        subject: "$_id",
        A: "$count",
        fullMark: 100,
      },
    },
  ]);

  const topCity = statsResult.topCities[0]?._id || "N/A";
  const peakHour = statsResult.peakHours[0]?._id;
  const peakTime =
    peakHour !== undefined ? `${peakHour}:00 - ${peakHour + 2}:00` : "N/A";

  const currentItems = statsResult.topProductsCurrent;
  const prevItems = statsResult.topProductsPrev;

  const formattedTopProducts = currentItems
    .map((item) => {
      const prevItem = prevItems.find(
        (p) => p._id?.toString() === item._id?.toString(),
      );
      const currSales = item.sales;
      const pSales = prevItem ? prevItem.sales : 0;

      let trend = 0;
      if (pSales === 0) {
        trend = currSales > 0 ? 100 : 0;
      } else {
        trend = Math.round(((currSales - pSales) / pSales) * 100);
      }

      return {
        name: item.name,
        sales: currSales,
        revenue: `₹${(item.revenue || 0).toLocaleString()}`,
        // Week-over-week trend has no meaning for a custom window.
        trend: dayRange ? null : trend,
      };
    })
    .slice(0, 5);

  const finalTrafficSources = (statsResult.trafficSources || []).map((s) => ({
    ...s,
    color: SOURCE_COLORS[s.name] || "#CBD5E1",
  }));
  if (finalTrafficSources.length === 0 && totalOrders > 0) {
    finalTrafficSources.push({ name: "Direct", value: totalOrders, color: "#3b82f6" });
  }

  const topDeviceType = statsResult.devices[0]?._id || "Mobile";
  const topDeviceCount = statsResult.devices[0]?.count || 0;
  const devicePerc =
    totalOrders > 0 ? Math.round((topDeviceCount / totalOrders) * 100) : 0;

  let daySummary = null;
  let rangeOrders = null;
  if (dayRange) {
    const rangeFilter = {
      seller: sellerOid,
      createdAt: { $gte: dayRange.start, $lt: dayRange.end },
    };
    const [statusAggregation, orderDocs] = await Promise.all([
      Order.aggregate([
        { $match: rangeFilter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ["$pricing.total", 0] } },
          },
        },
      ]),
      Order.find(rangeFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("customer", "name phone")
        .lean(),
    ]);
    const ordersByStatus = statusAggregation.map((row) => ({
      status: row._id || "unknown",
      count: row.count,
      amount: row.amount,
    }));
    daySummary = {
      from: dayRange.from,
      to: dayRange.to,
      days: dayRange.days,
      grossSales: totalSales,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue),
      cancelledOrders: ordersByStatus.find((row) => row.status === "cancelled")?.count || 0,
      deliveredOrders: ordersByStatus.find((row) => row.status === "delivered")?.count || 0,
      ordersByStatus,
    };
    rangeOrders = orderDocs;
  }

  return {
    ...(dayRange ? { daySummary, orders: rangeOrders } : {}),
    overview: {
      totalSales: `₹${totalSales.toLocaleString()}`,
      totalOrders: totalOrders.toLocaleString(),
      avgOrderValue: `₹${Math.round(avgOrderValue).toLocaleString()}`,
      conversionRate: totalOrders > 0 ? "4.2%" : "0%",
      salesTrend: `${salesTrendPerc > 0 ? "+" : ""}${salesTrendPerc}%`,
      ordersTrend: `${ordersTrendPerc > 0 ? "+" : ""}${ordersTrendPerc}%`,
    },
    salesTrend: chartData,
    categoryMix: categoryData,
    topProducts: formattedTopProducts,
    trafficSources: finalTrafficSources,
    insights: {
      topCity,
      peakTime,
      topDevice: totalOrders > 0 ? `${devicePerc}% ${topDeviceType}` : "N/A",
    },
  };
}

export default {
  getSellerStats,
};
