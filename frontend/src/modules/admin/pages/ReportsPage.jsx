import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Card from '@shared/components/ui/Card';
import Button from '@shared/components/ui/Button';
import Input from '@shared/components/ui/Input';
import { useToast } from '@shared/components/ui/Toast';
import { adminFinanceApi } from '@modules/admin/services/api/financeApi';
import { adminOrdersApi } from '@modules/admin/services/api/ordersApi';
import { Download } from 'lucide-react';
import { fetchTransactionReport, fetchFranchiseReport } from "../../../services/roleBasedReportService.js";
import { DataRangeInfo } from "../../../components/DataRangeInfo.jsx";

/** Convert an array of objects into an .xlsx file and trigger download, splitting Online/Offline if applicable. */
const exportToExcel = (data, filename) => {
  const workbook = XLSX.utils.book_new();

  // If data has franchiseId, it's the aggregated franchise report (keep as single sheet, it has columns now)
  const isAggregatedFranchiseReport = data.length > 0 && data[0].hasOwnProperty('franchiseId');

  if (isAggregatedFranchiseReport) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  } else {
    // For Orders and Ledger Entries, split them into Online and Offline
    const onlineData = [];
    const offlineData = [];

    data.forEach(row => {
      // deep copy to add custom column
      const newRow = { ...row };
      let isOffline = false;

      // Check Order fields for POS (Offline)
      if (row.posPaymentMethod || (row.adminNotes && String(row.adminNotes).toUpperCase().includes('POS'))) {
        isOffline = true;
      } 
      // Check Ledger/Transaction fields
      else if (row.paymentMode === 'CASH' || row.paymentMethod === 'CASH' || row.paymentMethod === 'OFFLINE') {
        isOffline = true;
      }
      else if (row.metadata && row.metadata.posPaymentMethod) {
        isOffline = true;
      }

      newRow['Source'] = isOffline ? 'Offline (POS)' : 'Online (App)';
      
      if (isOffline) {
        offlineData.push(newRow);
      } else {
        onlineData.push(newRow);
      }
    });

    // We can provide "sections" via sheets.
    // Let's add an "All Data" sheet.
    const allData = [...onlineData, ...offlineData];
    if (allData.length > 0) {
      const wsAll = XLSX.utils.json_to_sheet(allData);
      XLSX.utils.book_append_sheet(workbook, wsAll, 'All Data');
    }
    
    if (onlineData.length > 0) {
      const wsOnline = XLSX.utils.json_to_sheet(onlineData);
      XLSX.utils.book_append_sheet(workbook, wsOnline, 'Online');
    }

    if (offlineData.length > 0) {
      const wsOffline = XLSX.utils.json_to_sheet(offlineData);
      XLSX.utils.book_append_sheet(workbook, wsOffline, 'Offline (POS)');
    }

    if (allData.length === 0) {
      const worksheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    }
  }

  XLSX.writeFile(workbook, filename);
};

const REPORTS = [
  {
    id: 'app_transactions',
    title: 'App Transactions Report',
    subtitle:
      'Download a detailed Excel report of all app transactions within a specific date range.',
    fileName: 'app-transactions.xlsx',
    fetchFn: (params) => adminFinanceApi.getFinanceLedger(params),
    dataKey: null, // will auto-detect
  },
  {
    id: 'order_transactions',
    title: 'Order Transactions Report',
    subtitle:
      'Download a detailed Excel report of all order payments and statuses within a specific date range.',
    fileName: 'order-transactions.xlsx',
    fetchFn: (params) => adminOrdersApi.getOrders({ startDate: params.fromDate, endDate: params.toDate, limit: 1000 }),
    dataKey: null,
  },
  {
    id: 'revenue',
    title: 'Revenue Report',
    subtitle:
      'Generate a comprehensive summary of total revenue, taxes, and platform fees.',
    fileName: 'revenue-report.xlsx',
    fetchFn: (params) => adminOrdersApi.getOrders({ startDate: params.fromDate, endDate: params.toDate, limit: 1000 }),
    dataKey: null,
  },
];

const ReportCard = ({ report }) => {
  const { showToast } = useToast();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!report.fetchFn) {
      showToast('This report is not available yet.', 'warning');
      return;
    }

    if (!fromDate || !toDate) {
      showToast('Please select both From and To dates.', 'error');
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      showToast('"From" date cannot be after "To" date.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await report.fetchFn({ fromDate, toDate });
      const payload = res?.data;

      // Normalise: the API may return { data: [...] }, { results: [...] }, or a raw array
      let rows =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.results)
              ? payload.results
              : Array.isArray(payload?.result?.items)
                ? payload.result.items
                : Array.isArray(payload?.result?.data)
                  ? payload.result.data
                  : Array.isArray(payload?.orders)
                    ? payload.orders
                    : Array.isArray(payload?.items)
                      ? payload.items
                      : Array.isArray(payload?.transactions)
                        ? payload.transactions
                        : [];

      if (rows.length === 0) {
        showToast('No data found for the selected date range.', 'warning');
        return;
      }

      exportToExcel(rows, report.fileName);
      showToast(`${report.title} downloaded successfully!`, 'success');
    } catch (err) {
      console.error(`[ReportsPage] ${report.id} download error:`, err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong while fetching the report.';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [report, fromDate, toDate, showToast]);

  const isPlaceholder = !report.fetchFn;

  return (
    <Card title={report.title} subtitle={report.subtitle}>
      <div className="flex flex-col space-y-5 mt-2">
        <div className="flex items-center gap-4">
          <Input
            type="date"
            label="From Date"
            className="text-sm cursor-pointer"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            disabled={isPlaceholder}
          />
          <Input
            type="date"
            label="To Date"
            className="text-sm cursor-pointer"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            disabled={isPlaceholder}
          />
        </div>
        <Button
          variant="primary"
          className={`w-full font-bold flex items-center justify-center gap-2 py-5 ${
            isPlaceholder
              ? 'bg-gray-300 hover:bg-gray-300 cursor-not-allowed opacity-60'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
          isLoading={loading}
          disabled={isPlaceholder || loading}
          onClick={handleDownload}
        >
          <Download size={18} />
          {isPlaceholder ? 'Coming Soon' : 'Download Excel'}
        </Button>
      </div>
    </Card>
  );
};

const ReportsPage = () => {
  const { showToast } = useToast();
  const [franchiseFromDate, setFranchiseFromDate] = useState("");
  const [franchiseToDate, setFranchiseToDate] = useState("");
  const [franchiseLoading, setFranchiseLoading] = useState(false);
  
  const [reportData, setReportData] = useState(null);
  const [dataAccess, setDataAccess] = useState(null);

  React.useEffect(() => {
    const handleFetchReport = async () => {
      try {
        const data = await fetchTransactionReport();
        setReportData(data.data);
        setDataAccess(data.dataAccess);
      } catch (err) {
        console.error("Failed to fetch initial report data", err);
      }
    };
    handleFetchReport();
  }, []);

  const handleFranchiseDownload = async () => {
    if (!franchiseFromDate || !franchiseToDate) {
      showToast('Please select both From and To dates.', 'error');
      return;
    }
    setFranchiseLoading(true);
    try {
      const response = await adminFinanceApi.getFranchiseReport({
        fromDate: franchiseFromDate,
        toDate: franchiseToDate,
      });

      const payload = response?.data;
      const data = payload?.data || payload?.result?.data || [];
      
      if (data && data.length > 0) {
        exportToExcel(data, "franchise-report.xlsx");
        showToast("Franchise report downloaded successfully!", "success");
      } else {
        showToast("No franchise data found for the selected date range", "error");
      }
    } catch (error) {
      console.error("Error downloading franchise report:", error);
      showToast(error?.response?.data?.message || error.message || "Failed to download franchise report", "error");
    } finally {
      setFranchiseLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <DataRangeInfo dataAccess={dataAccess} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Reports Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate and download business performance reports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {REPORTS.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
        <Card title="Sellers-Wise Transaction" subtitle="View transaction and order data by seller">
          <div className="flex flex-col space-y-5 mt-2">
            <div className="flex items-center gap-4">
              <Input
                type="date"
                label="From Date"
                className="text-sm cursor-pointer"
                value={franchiseFromDate}
                onChange={(e) => setFranchiseFromDate(e.target.value)}
              />
              <Input
                type="date"
                label="To Date"
                className="text-sm cursor-pointer"
                value={franchiseToDate}
                onChange={(e) => setFranchiseToDate(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              className="w-full font-bold flex items-center justify-center gap-2 py-5 bg-green-600 hover:bg-green-700 text-white"
              isLoading={franchiseLoading}
              disabled={franchiseLoading}
              onClick={handleFranchiseDownload}
            >
              <Download size={18} />
              Download Excel
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
