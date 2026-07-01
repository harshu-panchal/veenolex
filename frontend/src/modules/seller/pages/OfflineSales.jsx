import React from "react";
import PageHeader from "@shared/components/ui/PageHeader";
import { SellerOfflineSalesTab } from "../../../components/SellerOfflineSalesTab";
import { motion } from "framer-motion";

const OfflineSales = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <PageHeader 
        title="Offline Sales" 
        description="Record and manage offline sales made at your physical store"
      />
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <SellerOfflineSalesTab />
      </div>
    </motion.div>
  );
};

export default OfflineSales;
