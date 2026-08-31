import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileCheck, Clock, AlertTriangle, ExternalLink } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";

/**
 * The Delivery record stores one URL per document plus a single
 * account-level `isVerified` flag — there is no per-document review state
 * in the backend, so a document is "Verified" only once the account has
 * been approved, "In review" while it is uploaded but the account is not,
 * and "Missing" when nothing was uploaded.
 */
const DOCUMENT_FIELDS = [
  { key: "aadhar", title: "Aadhar Card", hint: "Identity proof" },
  { key: "pan", title: "PAN Card", hint: "Tax identification" },
  { key: "drivingLicense", title: "Driving License", hint: "Required to accept trips" },
];

const STATUS_BADGES = {
  verified: {
    icon: FileCheck,
    label: "Verified",
    className: "text-brand-600 bg-brand-50",
  },
  in_review: {
    icon: Clock,
    label: "In review",
    className: "text-yellow-600 bg-yellow-50",
  },
  missing: {
    icon: AlertTriangle,
    label: "Missing",
    className: "text-red-600 bg-red-50",
  },
};

const Documents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const supportEmail = settings?.supportEmail;

  const isVerified = Boolean(user?.isVerified);

  const docs = DOCUMENT_FIELDS.map((field) => {
    const url = user?.documents?.[field.key] || null;
    let status = "missing";
    if (url) status = isVerified ? "verified" : "in_review";
    return { ...field, url, status };
  });

  const missingCount = docs.filter((doc) => doc.status === "missing").length;

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
          <h1 className="ds-h3 text-gray-900">My Documents</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Account-level verification banner */}
        <div
          className={`p-4 rounded-xl border flex items-start ${
            isVerified
              ? "bg-brand-50 border-brand-100"
              : "bg-yellow-50 border-yellow-100"
          }`}
        >
          {isVerified ? (
            <FileCheck size={20} className="text-brand-600 mr-3 shrink-0 mt-0.5" />
          ) : (
            <Clock size={20} className="text-yellow-600 mr-3 shrink-0 mt-0.5" />
          )}
          <div>
            <h4
              className={`font-bold text-sm mb-1 ${
                isVerified ? "text-brand-800" : "text-yellow-800"
              }`}
            >
              {isVerified ? "Account verified" : "Verification pending"}
            </h4>
            <p
              className={`text-xs leading-relaxed ${
                isVerified ? "text-brand-700" : "text-yellow-700"
              }`}
            >
              {isVerified
                ? "All submitted documents have been approved. You can accept trips."
                : missingCount > 0
                ? `${missingCount} document${missingCount > 1 ? "s are" : " is"} still missing. Our team will verify your account once everything is submitted.`
                : "Your documents are with our team. Verification usually completes within 48 hours."}
            </p>
          </div>
        </div>

        {docs.map((doc) => {
          const badge = STATUS_BADGES[doc.status];
          const BadgeIcon = badge.icon;

          return (
            <Card key={doc.key} className="p-4 border border-gray-100">
              <div className="flex justify-between items-start mb-2 gap-3">
                <div className="min-w-0">
                  <h4 className="font-bold text-gray-800">{doc.title}</h4>
                  <p className="text-xs text-gray-400">{doc.hint}</p>
                </div>
                <span
                  className={`flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${badge.className}`}
                >
                  <BadgeIcon size={12} className="mr-1" /> {badge.label}
                </span>
              </div>

              {doc.url ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 mt-2"
                  onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink size={14} className="mr-1" /> View File
                </Button>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Not submitted during registration.
                </p>
              )}
            </Card>
          );
        })}

        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Documents are submitted during registration and can only be replaced by
            our support team.
            {supportEmail ? (
              <>
                {" "}
                To update or re-upload a document, email{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="font-bold text-primary underline"
                >
                  {supportEmail}
                </a>
                .
              </>
            ) : (
              " Contact support to update or re-upload a document."
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Documents;
