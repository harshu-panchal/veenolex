import React from "react";
import { SellerDashboardSummary } from "./SellerDashboardSummary";
import { SellerOrdersList } from "./SellerOrdersList";
import { SellerReports } from "./SellerReports";

export const SellerPanelLast40DaysMobile = () => {
  return (
    <div style={{
      maxWidth: "100%",
      padding: "8px"
    }}>
      
      {/* DASHBOARD SECTION */}
      <section style={{ marginBottom: "12px" }}>
        <SellerDashboardSummary />
      </section>
      
      {/* ORDERS SECTION */}
      <section style={{ marginBottom: "12px" }}>
        <SellerOrdersList />
      </section>
      
      {/* REPORTS SECTION */}
      <section>
        <SellerReports />
      </section>
      
    </div>
  );
};
