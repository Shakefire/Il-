"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Building2,
  User,
  ShieldCheck,
  CreditCard,
  Loader2,
  Eye,
  FileText,
} from "lucide-react";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";

export default function ReviewStepPage() {
  const router = useRouter();
  const { data, submitApplication, isSubmitting } = useOnboarding();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document preview modal state
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
  }>({
    isOpen: false,
    title: "",
    url: "",
  });

  const handleOpenPreview = (title: string, url: string) => {
    if (!url) return;
    setPreviewModal({ isOpen: true, title, url });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreedToTerms) {
      setError("Please confirm agreement to the Ilé Partner Hosting Standards.");
      return;
    }

    try {
      await submitApplication();
      router.push("/host/onboarding/status");
    } catch (err: any) {
      setError(err.message || "Failed to submit verification dossier. Please try again.");
    }
  };

  const getHostTypeDisplay = () => {
    if (data.hostType === "company") return `Corporate Entity (${data.companyName || "Company"})`;
    if (data.hostType === "property_manager") return "Authorized Property Manager";
    return "Individual Property Owner";
  };

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, title: "", url: "" })}
        title={previewModal.title}
        url={previewModal.url}
      />

      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mb-2">
          Review your verification dossier
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Confirm your details before submitting for compliance verification and account approval. You can create and publish listings once verified.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start gap-2.5">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Review Cards Grid */}
        <div className="space-y-4">
          {/* 1. Qualification & Business */}
          <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0B5D45] uppercase tracking-wider">
                <Building2 size={15} />
                <span>1. Business Structure</span>
              </div>
              <h4 className="text-[15px] font-semibold text-[#171717] mt-1">{getHostTypeDisplay()}</h4>
              <p className="text-[13px] text-[#6B6B67]">
                Phone: {data.phone || "Not specified"}
              </p>
            </div>
            <Link
              href="/host/onboarding/business-type"
              className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1"
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </Link>
          </div>

          {/* 2. Personal Profile */}
          <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0B5D45] uppercase tracking-wider">
                <User size={15} />
                <span>2. Profile &amp; Operating Location</span>
              </div>
              <h4 className="text-[15px] font-semibold text-[#171717] mt-1">
                {data.firstName} {data.lastName}
              </h4>
              <p className="text-[13px] text-[#6B6B67]">
                Location: {data.operatingCity} ({data.operatingAreas || "Central"})
              </p>
              {data.residentialAddress && (
                <p className="text-[12.5px] text-[#8B8B86]">Address: {data.residentialAddress}</p>
              )}
            </div>
            <Link
              href="/host/onboarding/profile"
              className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1"
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </Link>
          </div>

          {/* 3. Identity Verification & Previews */}
          <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0B5D45] uppercase tracking-wider">
                <ShieldCheck size={15} />
                <span>3. Identity KYC</span>
              </div>
              <h4 className="text-[15px] font-semibold text-[#171717]">
                {data.idType.toUpperCase()} • {data.idNumber}
              </h4>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {data.idFrontUrl && (
                  <button
                    type="button"
                    onClick={() => handleOpenPreview("Government ID (Front)", data.idFrontUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#E7E5E0] text-xs font-medium text-[#0B5D45] hover:border-[#0B5D45] transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>View ID Front</span>
                  </button>
                )}
                {data.idBackUrl && (
                  <button
                    type="button"
                    onClick={() => handleOpenPreview("Government ID (Back)", data.idBackUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#E7E5E0] text-xs font-medium text-[#0B5D45] hover:border-[#0B5D45] transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>View ID Back</span>
                  </button>
                )}
                {data.selfieUrl && (
                  <button
                    type="button"
                    onClick={() => handleOpenPreview("Verification Selfie", data.selfieUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#E7E5E0] text-xs font-medium text-[#0B5D45] hover:border-[#0B5D45] transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>View Selfie</span>
                  </button>
                )}
              </div>
            </div>
            <Link
              href="/host/onboarding/identity"
              className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1 shrink-0"
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </Link>
          </div>

          {/* 4. Authority & Payouts with Document Preview */}
          <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0B5D45] uppercase tracking-wider">
                <CreditCard size={15} />
                <span>4. Authority &amp; Bank Account</span>
              </div>
              <h4 className="text-[15px] font-semibold text-[#171717]">
                {data.bankName} • {data.bankAccountNumber}
              </h4>
              <p className="text-[13px] text-[#6B6B67]">Account Name: {data.bankAccountName}</p>
              <div className="pt-1">
                {data.authorityDocUrl ? (
                  <button
                    type="button"
                    onClick={() => handleOpenPreview("Authority Verification Document", data.authorityDocUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#E7E5E0] text-xs font-medium text-[#0B5D45] hover:border-[#0B5D45] transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>View Authority Document</span>
                  </button>
                ) : (
                  <span className="text-xs text-amber-600 font-medium">Authority document missing</span>
                )}
              </div>
            </div>
            <Link
              href="/host/onboarding/authority"
              className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1 shrink-0"
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </Link>
          </div>
        </div>

        {/* Partner Agreement Confirmation */}
        <div className="p-4 rounded-xl bg-[#F4F7F5] border border-[#0B5D45]/20">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-[#0B5D45] focus:ring-[#0B5D45]/20 cursor-pointer accent-[#0B5D45]"
            />
            <span className="text-[13px] text-[#171717] leading-relaxed">
              I certify that all identification documents and property authority proofs are authentic, accurate, and lawfully obtained under the laws of the Federal Republic of Nigeria. I agree to comply with Ilé hospitality safety standards.
            </span>
          </label>
        </div>

        {/* Action Row */}
        <div className="pt-4 border-t border-[#E7E5E0] flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/host/onboarding/authority"
            className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors order-2 sm:order-1"
          >
            <ArrowLeft size={16} />
            <span>Back to Authority &amp; Payout</span>
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || !agreedToTerms}
            className="w-full sm:w-auto h-[52px] px-8 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[15px] font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer order-1 sm:order-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin text-white" />
                <span>Submitting Application...</span>
              </>
            ) : (
              <>
                <span>Submit Verification Dossier</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
