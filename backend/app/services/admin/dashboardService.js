import User from "../../models/customer.js";
import Seller from "../../models/seller.js";
import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import {
  IST_OFFSET,
  DAY_MS,
  getIstDateRange,
  toIstDateString,
  formatIstTime,
} from "../../utils/istDateRange.js";

const DASHBOARD_CATEGORY_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444"];
export async function getAdminDashboardStats({ from, to } = {}) {
  const dayRange = getIstDateRange(from, to);
  const dateMatch = dayRange
    ? { createdAt: { $gte: dayRange.start, $lt: dayRange.end } }
    : {};

  const [totalCustomers, totalSellers, totalRiders, totalOrders] =
    await Promise.all([
      User.countDocuments({ role: "user", ...dateMatch }),
      Seller.countDocuments(dateMatch),
      Delivery.countDocuments(dateMatch),
      Order.countDocuments(dateMatch),
    ]);

  const totalUsers = totalCustomers + totalSellers + totalRiders;
  const activeSellers = dayRange
    ? (await Order.distinct("seller", { ...dateMatch, status: { $ne: "cancelled" } })).filter(Boolean).length
    : await Seller.countDocuments({ isVerified: true });

  const revenueData = await Order.aggregate([
    { $match: { status: "delivered", ...dateMatch } },
    { $group: { _id: null, total: { $sum: "$pricing.total" } } },
  ]);
  const totalRevenue = revenueData[0]?.total || 0;

  let revenueHistory = [];
  if (dayRange?.days === 1) {
    // Hour-by-hour breakdown of the selected day (IST)
    const hourlyAggregation = await Order.aggregate([
      { $match: { ...dateMatch, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: { $hour: { date: "$createdAt", timezone: IST_OFFSET } },
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
          orders: { $sum: 1 },
        },
      },
    ]);
    const hourMap = new Map(hourlyAggregation.map((item) => [item._id, item]));
    for (let h = 0; h < 24; h++) {
      const suffix = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      revenueHistory.push({
        name: `${hour12} ${suffix}`,
        revenue: hourMap.get(h)?.revenue || 0,
        orders: hourMap.get(h)?.orders || 0,
      });
    }
  } else if (dayRange) {
    // Day-by-day breakdown of the selected range (IST)
    const dailyAggregation = await Order.aggregate([
      { $match: { ...dateMatch, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: IST_OFFSET } },
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
          orders: { $sum: 1 },
        },
      },
    ]);
    const dailyMap = new Map(dailyAggregation.map((item) => [item._id, item]));
    for (let i = 0; i < dayRange.days; i++) {
      const d = new Date(dayRange.start.getTime() + i * DAY_MS);
      const dateStr = toIstDateString(d);
      revenueHistory.push({
        name: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
        revenue: dailyMap.get(dateStr)?.revenue || 0,
        orders: dailyMap.get(dateStr)?.orders || 0,
        fullDate: dateStr,
      });
    }
  } else {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historyAggregation = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: "delivered" } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: IST_OFFSET },
          },
          revenue: { $sum: "$pricing.total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Create a map of existing revenue data
    const revenueMap = new Map(historyAggregation.map(item => [item._id, item.revenue]));

    // Fill in the last 30 days with 0 where no data exists
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      const dateStr = toIstDateString(d);
      revenueHistory.push({
        name: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
        revenue: revenueMap.get(dateStr) || 0,
        fullDate: dateStr
      });
    }
  }

  let daySummary = null;
  if (dayRange) {
    const statusAggregation = await Order.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$pricing.total", 0] } },
        },
      },
    ]);
    const ordersByStatus = statusAggregation.map((s) => ({
      status: s._id || "unknown",
      count: s.count,
      amount: s.amount,
    }));
    const nonCancelled = ordersByStatus.filter((s) => s.status !== "cancelled");
    const grossSales = nonCancelled.reduce((sum, s) => sum + s.amount, 0);
    const grossOrders = nonCancelled.reduce((sum, s) => sum + s.count, 0);
    daySummary = {
      from: dayRange.from,
      to: dayRange.to,
      days: dayRange.days,
      grossSales,
      avgOrderValue: grossOrders > 0 ? Math.round(grossSales / grossOrders) : 0,
      cancelledOrders: ordersByStatus.find((s) => s.status === "cancelled")?.count || 0,
      newCustomers: totalCustomers,
      newSellers: totalSellers,
      newRiders: totalRiders,
      ordersByStatus,
    };
  }

  const recentOrders = await Order.find(dateMatch)
    .sort({ createdAt: -1 })
    .limit(dayRange ? 50 : 5)
    .populate("customer", "name");

  const categoryData = await Product.aggregate([
    { $group: { _id: "$headerId", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    { $project: { name: "$category.name", value: "$count" } },
    { $limit: 4 },
  ]);

  const topProducts = await Order.aggregate([
    ...(dayRange ? [{ $match: { ...dateMatch, status: { $ne: "cancelled" } } }] : []),
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        sales: { $sum: "$items.quantity" },
        revenue: {
          $sum: { $multiply: ["$items.quantity", "$items.price"] },
        },
      },
    },
    { $sort: { sales: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        name: "$product.name",
        sales: 1,
        rev: "$revenue",
        image: "$product.mainImage",
      },
    },
  ]);

  return {
    overview: {
      totalUsers,
      activeSellers,
      totalOrders,
      totalRevenue,
    },
    revenueHistory,
    daySummary,
    recentOrders: recentOrders.map((order) => ({
      id: order.orderId,
      customer: order.customer?.name || "Guest",
      statusText: order.status,
      status:
        order.status === "delivered"
          ? "success"
          : order.status === "cancelled"
            ? "error"
            : "warning",
      amount: `\u20B9${order.pricing?.total ?? 0}`,
      time: dayRange ? formatIstTime(order.createdAt, dayRange.days > 1) : "Recently",
    })),
    categoryData: categoryData.map((category, index) => ({
      ...category,
      color: DASHBOARD_CATEGORY_COLORS[index % DASHBOARD_CATEGORY_COLORS.length],
    })),
    topProducts: topProducts.map((product) => ({
      name: product.name,
      sales: product.sales,
      rev: `\u20B9${product.rev.toFixed(2)}`,
      trend: "+5%",
      cat: "Product",
      image: product.image,
      icon: "\u{1F4E6}", // Fallback package icon
      color: "bg-blue-50 text-blue-600",
    })),
  };
}
