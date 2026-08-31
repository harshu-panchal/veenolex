import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark, AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";
import { deliveryApi } from "../../services/deliveryApi";

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{6,18}$/;

/** Shows only the last four digits — the rest never needs to be on screen. */
const maskAccountNumber = (accountNumber) => {
  const digits = String(accountNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  return `${"X".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
};

const emptyForm = { accountHolder: "", accountNumber: "", confirmAccountNumber: "", ifsc: "" };

const BankAccount = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const maskedAccount = maskAccountNumber(user?.accountNumber);
  const hasAccount = Boolean(maskedAccount);

  const setField = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    const accountNumber = form.accountNumber.replace(/\s+/g, "");
    const confirm = form.confirmAccountNumber.replace(/\s+/g, "");
    const ifsc = form.ifsc.replace(/\s+/g, "").toUpperCase();

    if (!form.accountHolder.trim()) {
      next.accountHolder = "Account holder name is required";
    }
    if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
      next.accountNumber = "Enter a valid account number (6-18 digits)";
    }
    if (accountNumber !== confirm) {
      next.confirmAccountNumber = "Account numbers do not match";
    }
    if (!IFSC_PATTERN.test(ifsc)) {
      next.ifsc = "Enter a valid IFSC (e.g. HDFC0001234)";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setIsSaving(true);
      await deliveryApi.updateProfile({
        accountHolder: form.accountHolder.trim(),
        accountNumber: form.accountNumber.replace(/\s+/g, ""),
        ifsc: form.ifsc.replace(/\s+/g, "").toUpperCase(),
      });
      await refreshUser();
      setForm(emptyForm);
      toast.success("Bank details updated");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to update bank details",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900">Bank Account</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Bank Card Visual */}
        <div className="bg-gradient-to-br from-brand-900 to-brand-800 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

          <div className="flex justify-between items-start mb-8 relative z-10">
            <Landmark size={32} className="text-white/80" />
            {hasAccount ? (
              <span className="bg-brand-500/20 text-brand-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-brand-500/30 flex items-center">
                <CheckCircle2 size={12} className="mr-1" /> On file
              </span>
            ) : (
              <span className="bg-white/10 text-white/70 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-white/20 flex items-center">
                <CircleDashed size={12} className="mr-1" /> Not added
              </span>
            )}
          </div>

          <div className="space-y-1 relative z-10">
            <p className="text-brand-200 text-xs uppercase tracking-wider">Account Number</p>
            <p className="font-mono text-2xl tracking-widest">
              {maskedAccount || "—— —— —— ——"}
            </p>
          </div>

          <div className="flex justify-between items-end mt-8 relative z-10 gap-4">
            <div className="min-w-0">
              <p className="text-brand-200 text-xs uppercase tracking-wider mb-1">Account Holder</p>
              <p className="font-bold text-lg truncate">
                {user?.accountHolder || user?.name || "Not provided"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-brand-200 text-xs uppercase tracking-wider mb-1">IFSC</p>
              <p className="text-white font-bold">{user?.ifsc || "Not provided"}</p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex items-start">
          <AlertTriangle size={20} className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-800 font-bold text-sm mb-1">Payment Information</h4>
            <p className="text-xs text-yellow-700 leading-relaxed">
              Approved withdrawals are transferred to this account. Make sure the
              name matches your bank records — a mismatch will cause the payout to
              be rejected by the bank.
            </p>
          </div>
        </div>

        {/* Update Form */}
        <div className="pt-2">
          <h3 className="ds-h4 text-gray-900 mb-4">
            {hasAccount ? "Update Account" : "Add Account"}
          </h3>
          <div className="space-y-4 bg-white p-4 rounded-xl shadow-sm">
            <Input
              label="Account Holder Name"
              placeholder="As printed on your passbook"
              value={form.accountHolder}
              onChange={setField("accountHolder")}
              error={errors.accountHolder}
            />
            <Input
              label="Account Number"
              placeholder="Enter account number"
              inputMode="numeric"
              value={form.accountNumber}
              onChange={setField("accountNumber")}
              error={errors.accountNumber}
            />
            <Input
              label="Confirm Account Number"
              placeholder="Re-enter account number"
              inputMode="numeric"
              value={form.confirmAccountNumber}
              onChange={setField("confirmAccountNumber")}
              error={errors.confirmAccountNumber}
            />
            <Input
              label="IFSC Code"
              placeholder="e.g. HDFC0001234"
              autoCapitalize="characters"
              value={form.ifsc}
              onChange={setField("ifsc")}
              error={errors.ifsc}
              className="uppercase"
            />
            <Button
              className="w-full mt-2"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Verify & Update"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankAccount;
