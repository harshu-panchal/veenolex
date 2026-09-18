import Order from "../models/order.js";
import Transaction from "../models/transaction.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import Wallet from "../models/wallet.js";
import { getSellerStats as getSellerStatsFromService } from "../services/seller/sellerStatsService.js";

/* ===============================
   GET SELLER DASHBOARD STATS
   Delegates to SellerStatsService (P6.2 — cache-fronted) so the heavy
   $facet aggregation + category pipeline are absorbed for ~60s.
================================ */
export const getSellerStats = async (req, res) => {
    try {
        const result = await getSellerStatsFromService(req.user.id, {
            range: req.query?.range,
        });
        return handleResponse(res, 200, "Stats fetched successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET SELLER EARNINGS / TRANSACTIONS
================================ */
export const getSellerEarnings = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const sellerOid = new mongoose.Types.ObjectId(sellerId);

        const fortyDaysAgo = new Date();
        fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

        const transactions = await Transaction.find({ 
            user: sellerId, 
            userModel: 'Seller',
            createdAt: { $gte: fortyDaysAgo }
        })
            .sort({ createdAt: -1 })
            .populate("order", "orderId paymentMode posPaymentMethod payment");

        const settledBalance = transactions
            .filter(t => t.status === 'Settled')
            .reduce((acc, t) => acc + t.amount, 0);

        const pendingPayouts = transactions
            .filter(t => t.type === 'Withdrawal' && (t.status === 'Pending' || t.status === 'Processing'))
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);

        // Fetch wallet for live pending balance (money on hold due to return window)
        const wallet = await Wallet.findOne({ ownerType: 'SELLER', ownerId: sellerId });
        const onHoldBalance = wallet ? wallet.pendingBalance : 0;
        const liveAvailableBalance = wallet ? wallet.availableBalance : settledBalance;

        // Keep "Total Revenue" aligned with Dashboard definition:
        // sum of non-cancelled seller orders from Order collection.
        const [orderRevenueAgg] = await Order.aggregate([
            {
                $match: {
                    seller: sellerOid,
                    status: { $ne: 'cancelled' },
                    createdAt: { $gte: fortyDaysAgo },
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
                },
            },
        ]);
        const totalRevenue = Number(orderRevenueAgg?.totalRevenue || 0);

        const totalWithdrawn = transactions
            .filter(t => t.type === 'Withdrawal' && t.status === 'Settled')
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);

        // Monthly Revenue Aggregation (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyAggregation = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(sellerId),
                    userModel: 'Seller',
                    type: 'Order Payment',
                    // Changed from sixMonthsAgo to fortyDaysAgo to enforce the 40-day data limit
                    createdAt: { $gte: fortyDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    revenue: { $sum: "$amount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const dateStr = d.toISOString().slice(0, 7);
            const data = monthlyAggregation.find(m => m._id === dateStr);
            chartData.push({
                name: monthNames[d.getMonth()],
                revenue: data ? data.revenue : 0
            });
        }

        return handleResponse(res, 200, "Earnings fetched successfully", {
            balances: {
                settledBalance: settledBalance,
                pendingPayouts: pendingPayouts,
                onHoldBalance: onHoldBalance, // New field
                availableBalance: liveAvailableBalance, // New field for clarity
                totalRevenue: totalRevenue,
                totalWithdrawn: totalWithdrawn
            },
            monthlyChart: chartData,
            ledger: transactions.map(t => {
                let paymentMethod = "Online";
                if (t.type === 'Withdrawal') {
                    paymentMethod = 'Bank Transfer';
                } else if (t.order) {
                    const rawMode = (t.order.paymentMode || t.order.posPaymentMethod || t.order.payment?.method || "").toUpperCase();
                    if (rawMode.includes("COD") || rawMode.includes("CASH")) {
                        paymentMethod = "COD";
                    } else if (rawMode.includes("ONLINE") || rawMode.includes("UPI") || rawMode.includes("CARD") || rawMode.includes("RAZORPAY") || rawMode.includes("PAYMENT")) {
                        paymentMethod = "Online";
                    } else if (rawMode.includes("WALLET")) {
                        paymentMethod = "Wallet";
                    } else if (rawMode.includes("CREDIT")) {
                        paymentMethod = "Credit";
                    } else if (t.order.paymentMode) {
                        paymentMethod = t.order.paymentMode;
                    }
                } else if (t.meta?.paymentMethod) {
                    const rawMeta = String(t.meta.paymentMethod).toUpperCase();
                    if (rawMeta.includes("CASH") || rawMeta.includes("COD")) paymentMethod = "COD";
                    else if (rawMeta.includes("ONLINE") || rawMeta.includes("UPI") || rawMeta.includes("CARD")) paymentMethod = "Online";
                    else paymentMethod = t.meta.paymentMethod;
                }

                return {
                    id: (t.reference || t._id).toString(),
                    type: t.type,
                    amount: t.amount,
                    status: t.status,
                    date: t.createdAt.toISOString().split('T')[0],
                    time: t.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    customer: t.type === 'Withdrawal' ? 'Bank Transfer' : 'Customer',
                    ref: t.order ? `#${t.order.orderId}` : t.reference || t._id,
                    paymentMethod: paymentMethod,
                    paymentMode: paymentMethod
                };
            })
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
