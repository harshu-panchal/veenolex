import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Package,
  Undo2,
  Gift,
  Banknote,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { deliveryApi } from "../services/deliveryApi";

const RUPEE = "\u20B9";
const DOT = "\u2022";

const money = (value) => `${RUPEE}${Number(value || 0).toLocaleString("en-IN")}`;

/**
 * Presentation for each rider transaction kind. The backend classifies the
 * row (`kind`/`label`); the map here only decides how it looks and whether
 * the amount reads as money in or money out.
 */
const TXN_STYLES = {
  delivery_payout: { icon: Package, tone: "bg-brand-100 text-brand-600", outgoing: false },
  return_commission: { icon: Undo2, tone: "bg-purple-100 text-purple-600", outgoing: false },
  incentive: { icon: Gift, tone: "bg-amber-100 text-amber-600", outgoing: false },
  bonus: { icon: Gift, tone: "bg-amber-100 text-amber-600", outgoing: false },
  cash_collection: { icon: Banknote, tone: "bg-slate-100 text-slate-600", outgoing: false },
  cash_settlement: { icon: Banknote, tone: "bg-slate-100 text-slate-600", outgoing: true },
  withdrawal: { icon: ArrowDownLeft, tone: "bg-rose-100 text-rose-600", outgoing: true },
  other: { icon: ArrowUpRight, tone: "bg-gray-100 text-gray-600", outgoing: false },
};

const resolveStyle = (txn) => TXN_STYLES[txn?.kind] || TXN_STYLES.other;

/** Falls back to the legacy enum for payloads from an older backend. */
const resolveLabel = (txn) => txn?.label || txn?.type || "Transaction";

const formatTxnDate = (txn) => {
  const raw = txn?.occurredAt || txn?.date || txn?.createdAt;
  const parsed = raw ? new Date(raw) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Base / distance / bonus / tip chips, only for rows that carry a split. */
const buildBreakdownParts = (txn) => {
  const breakdown = txn?.breakdown;
  if (!breakdown) return [];

  if (txn.kind === "return_commission") {
    return [{ label: "Return commission", value: breakdown.commission ?? txn.amount }];
  }

  return [
    { label: "Base", value: breakdown.base },
    { label: "Distance", value: breakdown.distance },
    { label: "Bonus", value: breakdown.bonus },
    { label: "Tip", value: breakdown.tip },
  ].filter((part) => Number(part.value || 0) > 0);
};

const EarningsPage = () => {
  const [activeTab, setActiveTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [rawEarningsResult, setRawEarningsResult] = useState(null);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const response = await deliveryApi.getEarnings();
      if (response.data.success && response.data.result) {
        setRawEarningsResult(response.data.result);
      }
    } catch {
      toast.error("Failed to fetch earnings data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEarnings();
  }, []);

  const activePeriodData = React.useMemo(() => {
    if (!rawEarningsResult) {
      return {
        totalEarnings: 0,
        incentives: 0,
        tipsReceived: 0,
        chartData: [],
        transactions: [],
      };
    }

    if (rawEarningsResult.periods && rawEarningsResult.periods[activeTab]) {
      return rawEarningsResult.periods[activeTab];
    }

    return {
      totalEarnings: rawEarningsResult.totalEarnings || 0,
      incentives: rawEarningsResult.incentives || 0,
      tipsReceived: rawEarningsResult.tipsReceived || 0,
      chartData: rawEarningsResult.chartData || [],
      transactions: rawEarningsResult.transactions || rawEarningsResult.recentTransactions || [],
    };
  }, [rawEarningsResult, activeTab]);

  const allTimeTotal = rawEarningsResult?.totalEarnings ?? activePeriodData.totalEarnings ?? 0;

  // Everything that is not an incentive/bonus is a per-delivery payout
  // (base + distance + tip), so the three tiles add up to the headline.
  const deliveryPayouts = Math.max(
    Number(activePeriodData.totalEarnings || 0) -
      Number(activePeriodData.incentives || 0),
    0,
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const periodLabel =
    activeTab === "today"
      ? "Today's Earnings"
      : activeTab === "weekly"
      ? "This Week's Earnings"
      : "This Month's Earnings";

  const chartPeriodLabel =
    activeTab === "today"
      ? "Today (Hourly)"
      : activeTab === "weekly"
      ? "Last 7 Days"
      : "Last 4 Weeks";

  return (
    <div className="bg-gray-50/50 min-h-screen pb-24">
      <div className="bg-white shadow-sm p-6 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="ds-h2 text-gray-900">My Earnings</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              All-Time Total: <span className="font-bold text-gray-800">{money(allTimeTotal)}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchEarnings()} title="Refresh earnings">
            <RefreshCw size={20} className="text-gray-600" />
          </Button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
          {["today", "weekly", "monthly"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all capitalize ${
                activeTab === tab
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        className="p-6 space-y-6 max-w-lg mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <div className="bg-gradient-to-br from-primary to-brand-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-10 -mb-10 blur-xl" />

            <div className="flex justify-between items-center mb-1 relative z-10">
              <p className="text-brand-100 font-medium text-sm uppercase tracking-wide">
                {periodLabel}
              </p>
              <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase">
                {activeTab}
              </span>
            </div>
            <div className="flex items-baseline mb-6 relative z-10">
              <span className="text-3xl font-bold mr-1">{RUPEE}</span>
              <span className="text-5xl font-extrabold tracking-tight">
                {Number(activePeriodData.totalEarnings || 0).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20 relative z-10">
              <div>
                <p className="text-brand-100 text-xs mb-1">Payouts</p>
                <p className="font-bold text-lg">{money(deliveryPayouts)}</p>
              </div>
              <div>
                <p className="text-brand-100 text-xs mb-1">Incentives</p>
                <p className="font-bold text-lg">
                  +{money(activePeriodData.incentives)}
                </p>
              </div>
              <div>
                <p className="text-brand-100 text-xs mb-1">Tips</p>
                <p className="font-bold text-lg">
                  +{money(activePeriodData.tipsReceived)}
                </p>
              </div>
            </div>
            <p className="text-brand-100/80 text-[10px] mt-3 relative z-10">
              Tips are already included in the total above.
            </p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800 flex items-center">
                <TrendingUp size={20} className="mr-2 text-brand-500" />
                Earnings Trend
              </h3>
              <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                {chartPeriodLabel}
              </span>
            </div>
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={activePeriodData.chartData || []} barSize={20} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    dy={10}
                  />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar dataKey="earnings" fill="var(--primary)" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="incentives" fill="#93c5fd" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 capitalize">{activeTab} Earnings & Deliveries</h3>
              <span className="text-xs font-semibold text-gray-500">
                {(activePeriodData.transactions || []).length} items
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {Array.isArray(activePeriodData.transactions) && activePeriodData.transactions.length > 0 ? (
                activePeriodData.transactions.map((txn, idx) => {
                  const style = resolveStyle(txn);
                  const Icon = style.icon;
                  const isSettled =
                    txn.status === "Settled" || txn.status === "Completed";
                  const parts = buildBreakdownParts(txn);
                  const orderId = txn.order?.orderId;

                  return (
                    <div
                      key={txn._id || txn.id || `txn-${idx}`}
                      className="p-4 flex justify-between items-start gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start min-w-0">
                        <div className={`p-2 rounded-full mr-3 shrink-0 ${style.tone}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900">{resolveLabel(txn)}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {formatTxnDate(txn)}
                            {orderId ? ` ${DOT} #${orderId}` : ""}
                          </p>

                          {parts.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {parts.map((part) => (
                                <span
                                  key={part.label}
                                  className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded"
                                >
                                  {part.label} {money(part.value)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">
                          {style.outgoing ? "-" : "+"}
                          {money(txn.amount)}
                        </p>
                        <p
                          className={`text-xs font-bold ${
                            isSettled ? "text-brand-500" : "text-yellow-500"
                          }`}
                        >
                          {txn.status}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-gray-400 text-sm italic">
                  No earnings recorded for {activeTab}.
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default EarningsPage;

