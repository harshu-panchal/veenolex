import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import Orders from "../pages/Orders";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineChartBarSquare,
  HiOutlineCreditCard,
  HiOutlineMapPin,
  HiOutlineShoppingCart,
  HiOutlineShoppingBag,
} from "react-icons/hi2";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const StockManagement = React.lazy(() => import("../pages/StockManagement"));

// Note: Orders is imported eagerly above to avoid dynamic import issues
const OfflineSales = React.lazy(() => import("../pages/OfflineSales"));
const Returns = React.lazy(() => import("../pages/Returns"));
const Earnings = React.lazy(() => import("../pages/Earnings"));
const Analytics = React.lazy(() => import("../pages/Analytics"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));
const RequestProduct = React.lazy(() => import("../pages/RequestProduct"));
const RequestedOrdersList = React.lazy(() => import("../pages/RequestedOrdersList"));
const RequestedOrderDetails = React.lazy(() => import("../pages/RequestedOrderDetails"));

// ── POS Lazy Pages ───────────────────────────────────────────────────
const SellerPOSOrders = React.lazy(() => import("../pages/pos/SellerPOSOrders"));
const SellerPOSReport = React.lazy(() => import("../pages/pos/SellerPOSReport"));
const SellerPOSBillSettings = React.lazy(() => import("../pages/pos/SellerPOSBillSettings"));
const SellerPOSPaymentSuccess = React.lazy(() => import("../pages/pos/SellerPOSPaymentSuccess"));

const navItems = [
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Products", path: "/seller/products", icon: HiOutlineCube },
  { label: "Orders", path: "/seller/orders", icon: HiOutlineTruck },
  { label: "Request Product", path: "/seller/request-product", icon: HiOutlineShoppingBag },
  { label: "Requested Orders", path: "/seller/requested-orders", icon: HiOutlineShoppingBag },
  { label: "Offline Sales", path: "/seller/offline-sales", icon: HiOutlineShoppingCart },
  { label: "Returns", path: "/seller/returns", icon: HiOutlineArchiveBox },
  { label: "Track Orders", path: "/seller/tracking", icon: HiOutlineMapPin },
  {
    label: "Sales Reports",
    path: "/seller/analytics",
    icon: HiOutlineChartBarSquare,
  },
  {
    label: "Money Request",
    path: "/seller/withdrawals",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "Payment History",
    path: "/seller/transactions",
    icon: HiOutlineCreditCard,
  },
  {
    label: "Earnings",
    path: "/seller/earnings",
    icon: HiOutlineCurrencyDollar,
  },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
  { label: "POS Billing", path: "/seller/pos/orders", icon: HiOutlineShoppingBag },
  { label: "POS Invoice History", path: "/seller/pos/report", icon: HiOutlineChartBarSquare },
  { label: "POS Receipt Settings", path: "/seller/pos/bill-settings", icon: HiOutlineCreditCard },
];

const SellerRoutes = () => {
  useEffect(() => {
    setActiveRole(ROLES.SELLER);
  }, []);

  return (
    <DashboardLayout navItems={navItems} title="Seller Panel">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<ProductManagement />} />

        <Route path="/inventory" element={<StockManagement />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/request-product" element={<RequestProduct />} />
        <Route path="/requested-orders" element={<RequestedOrdersList />} />
        <Route path="/requested-orders/:requestId" element={<RequestedOrderDetails />} />
        <Route path="/offline-sales" element={<OfflineSales />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/tracking" element={<DeliveryTracking />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/withdrawals" element={<Withdrawals />} />
        <Route path="/profile" element={<Profile />} />
        {/* ── POS Route Entries ────────────────────────────────────────── */}
        <Route path="/pos/orders" element={<SellerPOSOrders />} />
        <Route path="/pos/report" element={<SellerPOSReport />} />
        <Route path="/pos/bill-settings" element={<SellerPOSBillSettings />} />
        <Route path="/pos/success" element={<SellerPOSPaymentSuccess />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default SellerRoutes;
