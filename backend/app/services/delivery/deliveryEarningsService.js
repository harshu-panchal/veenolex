/**
 * DeliveryEarningsService
 *
 * Owns the read-side aggregations for the delivery partner's dashboard:
 *   - getDeliveryStats         ← getDeliveryStats handler
 *   - getDeliveryEarnings      ← getDeliveryEarnings handler
 *   - getDeliveryCodCashSummary ← getDeliveryCodCashSummary handler
 *
 * Framework-agnostic. Inputs are primitives; output shapes are additive
 * over the previous payloads so existing frontend consumers keep working.
 *
 * Two correctness rules everything here follows:
 *
 *   1. **Business timezone, not server timezone.** Period boundaries come
 *      from `startOfZonedDay` (`APP_TIMEZONE`, default Asia/Kolkata). A
 *      UTC-hosted process previously rolled "today" over at 05:30 IST, so
 *      earnings settled between midnight and 05:30 IST were counted into
 *      the previous day — the "today ₹0 but all-time ₹140" symptom.
 *
 *   2. **Effective transaction date.** A rider is paid when the order is
 *      *settled*, which can be a different calendar day from when the
 *      order row was first written. `EFFECTIVE_DATE_EXPR` / `effectiveDate()`
 *      resolve `date → updatedAt → createdAt` so both the totals and the
 *      chart buckets key off the settlement timestamp the UI displays.
 *
 * Throws errors with `err.statusCode` for the auth-failure cases the COD
 * summary handler used to handle inline.
 */

import mongoose from "mongoose";
import Order from "../../models/order.js";
import Transaction from "../../models/transaction.js";
import Wallet from "../../models/wallet.js";
import { roundCurrency } from "../../utils/money.js";
import { APP_TIMEZONE, startOfZonedDay, zonedDateKey, zonedWeekday } from "../../utils/timezone.js";
import { buildKey, getOrSet, getTTL } from "../cacheService.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Transaction types that count as rider income. */
const EARNING_TYPES = ["Delivery Earning", "Incentive", "Bonus"];
/** Subset that is a top-up rather than a per-delivery payout. */
const INCENTIVE_TYPES = ["Incentive", "Bonus"];

/** Mongo expression mirroring `effectiveDate()` below. */
const EFFECTIVE_DATE_EXPR = {
  $ifNull: ["$date", { $ifNull: ["$updatedAt", "$createdAt"] }],
};

function svcErr(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toDeliveryBoyId(rawId) {
  if (rawId == null) {
    throw svcErr("Unauthorized", 401);
  }
  if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw svcErr("Invalid user id", 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

/**
 * When this money actually landed for the rider. Settlement stamps `date`
 * on insert; `updatedAt`/`createdAt` are fallbacks for legacy rows.
 */
function effectiveDate(txn) {
  return new Date(txn?.date || txn?.updatedAt || txn?.createdAt || 0);
}

/** Period boundaries in the business timezone. */
function getPeriodBoundaries(now = new Date()) {
  return {
    now,
    startOfToday: startOfZonedDay(now, APP_TIMEZONE),
    // Last 7 / 30 *calendar* days including today, so the chart columns and
    // the headline totals always agree.
    startOfWeek: startOfZonedDay(now, APP_TIMEZONE, -6),
    startOfMonth: startOfZonedDay(now, APP_TIMEZONE, -29),
  };
}

/**
 * One pass over every settled earning transaction, bucketed by period.
 * Runs in Mongo so totals are not capped by any `limit()` on the
 * transaction list we fetch for display.
 */
async function aggregatePeriodTotals(deliveryBoyId, bounds) {
  const sumWhenAfter = (start, valueExpr) => ({
    $sum: { $cond: [{ $gte: ["$effectiveDate", start] }, valueExpr, 0] },
  });
  const incentiveAmount = {
    $cond: [{ $in: ["$type", INCENTIVE_TYPES] }, "$amount", 0],
  };
  const tipAmount = {
    $cond: [
      { $eq: ["$type", "Delivery Earning"] },
      { $ifNull: ["$meta.tipAmount", 0] },
      0,
    ],
  };
  const deliveryPayout = {
    $cond: [{ $eq: ["$type", "Delivery Earning"] }, "$amount", 0],
  };

  const [row] = await Transaction.aggregate([
    {
      $match: {
        user: deliveryBoyId,
        userModel: "Delivery",
        status: "Settled",
        type: { $in: EARNING_TYPES },
      },
    },
    { $addFields: { effectiveDate: EFFECTIVE_DATE_EXPR } },
    {
      $group: {
        _id: null,
        allTotal: { $sum: "$amount" },
        allIncentives: { $sum: incentiveAmount },
        allTips: { $sum: tipAmount },
        allPayouts: { $sum: deliveryPayout },
        allCount: { $sum: 1 },

        todayTotal: sumWhenAfter(bounds.startOfToday, "$amount"),
        todayIncentives: sumWhenAfter(bounds.startOfToday, incentiveAmount),
        todayTips: sumWhenAfter(bounds.startOfToday, tipAmount),
        todayCount: sumWhenAfter(bounds.startOfToday, 1),

        weeklyTotal: sumWhenAfter(bounds.startOfWeek, "$amount"),
        weeklyIncentives: sumWhenAfter(bounds.startOfWeek, incentiveAmount),
        weeklyTips: sumWhenAfter(bounds.startOfWeek, tipAmount),

        monthlyTotal: sumWhenAfter(bounds.startOfMonth, "$amount"),
        monthlyIncentives: sumWhenAfter(bounds.startOfMonth, incentiveAmount),
        monthlyTips: sumWhenAfter(bounds.startOfMonth, tipAmount),
      },
    },
  ]);

  const read = (key) => roundCurrency(row?.[key] || 0);
  return {
    allTotal: read("allTotal"),
    allIncentives: read("allIncentives"),
    allTips: read("allTips"),
    allPayouts: read("allPayouts"),
    allCount: Number(row?.allCount || 0),
    todayTotal: read("todayTotal"),
    todayIncentives: read("todayIncentives"),
    todayTips: read("todayTips"),
    todayCount: Number(row?.todayCount || 0),
    weeklyTotal: read("weeklyTotal"),
    weeklyIncentives: read("weeklyIncentives"),
    weeklyTips: read("weeklyTips"),
    monthlyTotal: read("monthlyTotal"),
    monthlyIncentives: read("monthlyIncentives"),
    monthlyTips: read("monthlyTips"),
  };
}

/**
 * Dashboard summary: total deliveries, today's earnings, incentives, cash in hand.
 * Cached for ~30s (`deliveryStats` TTL) to absorb dashboard polling.
 */
export async function getDeliveryStats(rawId) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const cacheKey = buildKey("delivery", "stats", String(deliveryBoyId));
  return getOrSet(
    cacheKey,
    () => computeDeliveryStats(deliveryBoyId),
    getTTL("deliveryStats"),
  );
}

async function computeDeliveryStats(deliveryBoyId) {
  const bounds = getPeriodBoundaries();

  const [orders, totals, wallet] = await Promise.all([
    Order.find({ deliveryBoy: deliveryBoyId, status: "delivered" })
      .select("_id deliveredAt updatedAt")
      .lean(),
    aggregatePeriodTotals(deliveryBoyId, bounds),
    Wallet.findOne({
      ownerType: "DELIVERY_PARTNER",
      ownerId: deliveryBoyId,
    })
      .select("cashInHand")
      .lean(),
  ]);

  const totalDeliveries = orders.length;
  // `deliveredAt` is the real completion stamp; `updatedAt` only backfills
  // legacy rows written before that field existed.
  const todayDeliveries = orders.filter((order) => {
    const at = order.deliveredAt || order.updatedAt;
    return at && new Date(at) >= bounds.startOfToday;
  }).length;

  return {
    today: totals.todayTotal,
    todayDeliveries,
    todayTips: totals.todayTips,
    deliveries: totalDeliveries,
    weeklyEarnings: totals.weeklyTotal,
    monthlyEarnings: totals.monthlyTotal,
    totalLifetimeEarnings: totals.allTotal,
    incentives: totals.todayIncentives,
    lifetimeIncentives: totals.allIncentives,
    cashCollected: roundCurrency(wallet?.cashInHand || 0),
    timezone: APP_TIMEZONE,
  };
}

/**
 * Earnings page payload: totals, per-period charts, transaction breakdown.
 * Cached for ~30s (`deliveryEarnings` TTL) to absorb dashboard polling.
 */
export async function getDeliveryEarnings(rawId) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const cacheKey = buildKey("delivery", "earnings", String(deliveryBoyId));
  return getOrSet(
    cacheKey,
    () => computeDeliveryEarnings(deliveryBoyId),
    getTTL("deliveryEarnings"),
  );
}

/**
 * Human-readable classification for a rider transaction. The rider app
 * shows "Delivery Payout" / "Return Pickup Commission" rather than the
 * raw `Delivery Earning` enum, which covers both.
 */
function classifyTransaction(txn) {
  const reference = String(txn?.reference || "");
  const flow = txn?.meta?.flow;

  switch (txn?.type) {
    case "Incentive":
      return { kind: "incentive", label: "Incentive" };
    case "Bonus":
      return { kind: "bonus", label: "Bonus" };
    case "Withdrawal":
      return { kind: "withdrawal", label: "Withdrawal" };
    case "Cash Collection":
      return { kind: "cash_collection", label: "COD Cash Collected" };
    case "Cash Settlement":
      return { kind: "cash_settlement", label: "Cash Remitted to Admin" };
    case "Delivery Earning":
      if (flow === "return_pickup_commission" || reference.startsWith("RET-")) {
        return { kind: "return_commission", label: "Return Pickup Commission" };
      }
      return { kind: "delivery_payout", label: "Delivery Payout" };
    default:
      return { kind: "other", label: txn?.type || "Transaction" };
  }
}

/**
 * Base + distance + bonus + tip split, straight from the admin-configured
 * rider payout rules recorded on the order at settlement time.
 */
const EMPTY_BREAKDOWN = Object.freeze({
  base: 0,
  distance: 0,
  bonus: 0,
  tip: 0,
  commission: 0,
  hasSplit: false,
});

function buildBreakdown(txn, kind) {
  // Only rider payouts have a base/distance/tip split. Cash-collection,
  // remittance and withdrawal rows are attached to an order too, so
  // without this guard they would inherit that order's payout figures and
  // claim a breakdown that has nothing to do with the row's amount.
  if (kind !== "delivery_payout" && kind !== "return_commission") {
    return EMPTY_BREAKDOWN;
  }

  const meta = txn?.meta || {};
  const breakdown = txn?.order?.paymentBreakdown || {};

  const base = roundCurrency(meta.payoutBase ?? breakdown.riderPayoutBase ?? 0);
  const distance = roundCurrency(
    meta.payoutDistance ?? breakdown.riderPayoutDistance ?? 0,
  );
  const bonus = roundCurrency(
    meta.payoutBonus ?? breakdown.riderPayoutBonus ?? 0,
  );
  const tip = roundCurrency(
    meta.tipAmount ??
      breakdown.riderTipAmount ??
      txn?.order?.pricing?.tip ??
      0,
  );

  if (kind === "return_commission") {
    // Return pickups are a flat, seller-funded commission — there is no
    // base/distance split to show.
    return {
      base: 0,
      distance: 0,
      bonus: 0,
      tip: 0,
      commission: roundCurrency(txn?.amount || 0),
      hasSplit: false,
    };
  }

  return {
    base,
    distance,
    bonus,
    tip,
    commission: 0,
    hasSplit: base > 0 || distance > 0 || bonus > 0 || tip > 0,
  };
}

function serializeTransaction(txn) {
  const plain = typeof txn?.toObject === "function" ? txn.toObject() : txn;
  const { kind, label } = classifyTransaction(plain);
  const at = effectiveDate(plain);

  return {
    _id: plain._id,
    type: plain.type,
    kind,
    label,
    amount: roundCurrency(plain.amount || 0),
    status: plain.status,
    reference: plain.reference,
    // `date` stays an ISO string so existing consumers keep working, and
    // `occurredAt` names the resolved settlement stamp explicitly.
    date: at.toISOString(),
    occurredAt: at.toISOString(),
    createdAt: plain.createdAt,
    meta: plain.meta || {},
    breakdown: buildBreakdown(plain, kind),
    order: plain.order
      ? {
          _id: plain.order._id,
          orderId: plain.order.orderId,
          paymentBreakdown: plain.order.paymentBreakdown,
          pricing: plain.order.pricing,
        }
      : null,
  };
}

/** Daily totals for the last 30 zoned days, keyed "YYYY-MM-DD". */
async function aggregateDailyEarnings(deliveryBoyId, bounds) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        user: deliveryBoyId,
        userModel: "Delivery",
        status: "Settled",
        type: { $in: EARNING_TYPES },
      },
    },
    { $addFields: { effectiveDate: EFFECTIVE_DATE_EXPR } },
    { $match: { effectiveDate: { $gte: bounds.startOfMonth } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$effectiveDate",
            timezone: APP_TIMEZONE,
          },
        },
        earnings: { $sum: "$amount" },
        incentives: {
          $sum: { $cond: [{ $in: ["$type", INCENTIVE_TYPES] }, "$amount", 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return new Map(
    rows.map((row) => [
      row._id,
      {
        earnings: roundCurrency(row.earnings || 0),
        incentives: roundCurrency(row.incentives || 0),
      },
    ]),
  );
}

/** Today's totals per zoned hour (0-23). */
async function aggregateTodayByHour(deliveryBoyId, bounds) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        user: deliveryBoyId,
        userModel: "Delivery",
        status: "Settled",
        type: { $in: EARNING_TYPES },
      },
    },
    { $addFields: { effectiveDate: EFFECTIVE_DATE_EXPR } },
    { $match: { effectiveDate: { $gte: bounds.startOfToday } } },
    {
      $group: {
        _id: { $hour: { date: "$effectiveDate", timezone: APP_TIMEZONE } },
        earnings: { $sum: "$amount" },
      },
    },
  ]);

  return new Map(rows.map((row) => [Number(row._id), Number(row.earnings || 0)]));
}

const TODAY_SLOTS = [
  { name: "6 AM", from: 0, to: 9 },
  { name: "9 AM", from: 9, to: 12 },
  { name: "12 PM", from: 12, to: 15 },
  { name: "3 PM", from: 15, to: 18 },
  { name: "6 PM", from: 18, to: 21 },
  { name: "9 PM", from: 21, to: 24 },
];

function buildTodayChart(hourlyMap) {
  return TODAY_SLOTS.map((slot) => {
    let total = 0;
    for (let hour = slot.from; hour < slot.to; hour += 1) {
      total += hourlyMap.get(hour) || 0;
    }
    return { name: slot.name, earnings: roundCurrency(total), incentives: 0 };
  });
}

function buildWeeklyChart(dailyMap, now) {
  const chart = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dayStart = startOfZonedDay(now, APP_TIMEZONE, -i);
    const key = zonedDateKey(dayStart, APP_TIMEZONE);
    const found = dailyMap.get(key);
    chart.push({
      name: DAY_NAMES[zonedWeekday(dayStart, APP_TIMEZONE)],
      date: key,
      earnings: found?.earnings || 0,
      incentives: found?.incentives || 0,
    });
  }
  return chart;
}

function buildMonthlyChart(dailyMap, now) {
  const weeks = [
    { name: "Week 1", earnings: 0, incentives: 0 },
    { name: "Week 2", earnings: 0, incentives: 0 },
    { name: "Week 3", earnings: 0, incentives: 0 },
    { name: "Week 4", earnings: 0, incentives: 0 },
  ];

  // Day 0 = today (rightmost bucket), day 29 = 30 days ago. The window is
  // 30 days but there are only 4 buckets, so the oldest two days fold into
  // "Week 1" — that keeps the bars summing to the headline monthly total.
  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const dayStart = startOfZonedDay(now, APP_TIMEZONE, -dayOffset);
    const found = dailyMap.get(zonedDateKey(dayStart, APP_TIMEZONE));
    if (!found) continue;
    const bucket = weeks[3 - Math.min(Math.floor(dayOffset / 7), 3)];
    bucket.earnings = roundCurrency(bucket.earnings + found.earnings);
    bucket.incentives = roundCurrency(bucket.incentives + found.incentives);
  }

  return weeks;
}

async function computeDeliveryEarnings(deliveryBoyId) {
  const bounds = getPeriodBoundaries();

  const [rawTransactions, wallet, totals, dailyMap, hourlyMap] =
    await Promise.all([
      Transaction.find({ user: deliveryBoyId, userModel: "Delivery" })
        .sort({ createdAt: -1 })
        .limit(300)
        .populate("order", "orderId pricing paymentBreakdown")
        .lean(),
      Wallet.findOne({
        ownerType: "DELIVERY_PARTNER",
        ownerId: deliveryBoyId,
      })
        .select("cashInHand")
        .lean(),
      aggregatePeriodTotals(deliveryBoyId, bounds),
      aggregateDailyEarnings(deliveryBoyId, bounds),
      aggregateTodayByHour(deliveryBoyId, bounds),
    ]);

  // Re-sort on the effective date: `createdAt` order can differ from
  // settlement order for rows written at placement and settled later.
  const transactions = rawTransactions
    .map(serializeTransaction)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  const settledEarnings = transactions.filter(
    (t) => t.status === "Settled" && EARNING_TYPES.includes(t.type),
  );
  const since = (start) =>
    settledEarnings.filter((t) => new Date(t.occurredAt) >= start);

  const todayChartData = buildTodayChart(hourlyMap);
  const weeklyChartData = buildWeeklyChart(dailyMap, bounds.now);
  const monthlyChartData = buildMonthlyChart(dailyMap, bounds.now);

  const cashCollected = roundCurrency(wallet?.cashInHand || 0);

  return {
    // Backwards-compatible root keys (all-time).
    totalEarnings: totals.allTotal,
    onlinePay: totals.allTotal,
    incentives: totals.allIncentives,
    tipsReceived: totals.allTips,
    deliveryPayouts: totals.allPayouts,
    cashCollected,
    chartData: weeklyChartData,
    transactions: transactions.slice(0, 20),
    timezone: APP_TIMEZONE,

    periods: {
      today: {
        totalEarnings: totals.todayTotal,
        incentives: totals.todayIncentives,
        tipsReceived: totals.todayTips,
        transactionCount: totals.todayCount,
        chartData: todayChartData,
        transactions: since(bounds.startOfToday).slice(0, 20),
      },
      weekly: {
        totalEarnings: totals.weeklyTotal,
        incentives: totals.weeklyIncentives,
        tipsReceived: totals.weeklyTips,
        chartData: weeklyChartData,
        transactions: since(bounds.startOfWeek).slice(0, 20),
      },
      monthly: {
        totalEarnings: totals.monthlyTotal,
        incentives: totals.monthlyIncentives,
        tipsReceived: totals.monthlyTips,
        chartData: monthlyChartData,
        transactions: since(bounds.startOfMonth).slice(0, 30),
      },
      allTime: {
        totalEarnings: totals.allTotal,
        incentives: totals.allIncentives,
        tipsReceived: totals.allTips,
        transactionCount: totals.allCount,
        chartData: weeklyChartData,
        transactions: settledEarnings.slice(0, 30),
      },
    },
  };
}

/**
 * COD cash summary: system float, cash in hand, per-order toRemit/toCollect.
 * Cached for ~30s (`deliveryCodSummary` TTL).
 */
export async function getDeliveryCodCashSummary(rawId) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const cacheKey = buildKey("delivery", "codSummary", String(deliveryBoyId));
  return getOrSet(
    cacheKey,
    () => computeDeliveryCodCashSummary(deliveryBoyId),
    getTTL("deliveryCodSummary"),
  );
}

async function computeDeliveryCodCashSummary(deliveryBoyId) {
  const wallet = await Wallet.findOne({
    ownerType: "DELIVERY_PARTNER",
    ownerId: deliveryBoyId,
  })
    .select("cashInHand")
    .lean();

  const orders = await Order.find({
    deliveryBoy: deliveryBoyId,
    paymentMode: "COD",
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "cancelled" },
  })
    .select(
      "orderId status orderStatus deliveredAt createdAt financeFlags paymentBreakdown pricing",
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const normalized = orders.map((order) => {
    const codMarkedCollected = Boolean(
      order.financeFlags?.codMarkedCollected,
    );
    const gross = roundCurrency(
      order.paymentBreakdown?.grandTotal ?? order.pricing?.total ?? 0,
    );
    const riderCommission = roundCurrency(
      order.paymentBreakdown?.riderPayoutTotal ?? 0,
    );

    const estimatedNet = roundCurrency(Math.max(gross - riderCommission, 0));
    const pendingNet = roundCurrency(
      order.paymentBreakdown?.codPendingAmount ?? 0,
    );
    const contribution = codMarkedCollected ? pendingNet : estimatedNet;

    return {
      orderId: order.orderId,
      status: order.status,
      orderStatus: order.orderStatus,
      deliveredAt: order.deliveredAt || null,
      createdAt: order.createdAt || null,
      codMarkedCollected,
      amountGross: gross,
      riderCommission,
      amountNetExpected: estimatedNet,
      amountNetPending: pendingNet,
      systemFloatContribution: contribution,
    };
  });

  const systemFloatCOD = roundCurrency(
    normalized.reduce(
      (sum, row) => sum + Number(row.systemFloatContribution || 0),
      0,
    ),
  );

  const toRemit = normalized
    .filter(
      (row) => row.codMarkedCollected && Number(row.amountNetPending || 0) > 0,
    )
    .slice(0, 50);

  const toCollect = normalized
    .filter(
      (row) =>
        !row.codMarkedCollected && Number(row.amountNetExpected || 0) > 0,
    )
    .slice(0, 50);

  return {
    systemFloatCOD,
    cashInHand: roundCurrency(wallet?.cashInHand || 0),
    toRemit,
    toCollect,
  };
}

export default {
  getDeliveryStats,
  getDeliveryEarnings,
  getDeliveryCodCashSummary,
};
