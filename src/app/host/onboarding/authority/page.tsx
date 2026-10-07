"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  CheckCircle2,
  CreditCard,
  FileCheck,
  Loader2,
  Eye,
  Trash2,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { compressFile } from "@/lib/imageCompression";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";

const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Bank",
  "Moniepoint MFB",
  "OPay",
  "Palmpay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "Taj Bank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank / ALAT",
  "Zenith Bank",
];

export default function AuthorityStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Document preview modal
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; title: string; url: string }>({
    isOpen: false,
    title: "",
    url: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB maximum limit. Please upload a file up to 15MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingDoc(true);
    setError(null);

    try {
      // Process & compress file (validates 15MB limit)
      const compressedDataUrl = await compressFile(file);

      try {
        const res = await api.uploadImage(compressedDataUrl, "authority");
        const url = res.url || compressedDataUrl;
        updateData({ authorityDocUrl: url });
      } catch {
        // Fall back to processed data URL
        updateData({ authorityDocUrl: compressedDataUrl });
      }
    } catch (err: any) {
      setError(err.message || "Failed to process document file. Please choose another file.");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveDoc = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateData({ authorityDocUrl: "" });
  };

  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewModal({
      isOpen: true,
      title: getDocTypeLabel(),
      url: data.authorityDocUrl,
    });
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.authorityDocUrl) {
      setError("Please upload proof of property authority or title deed.");
      return;
    }

    if (!data.bankAccountNumber || data.bankAccountNumber.length < 10) {
      setError("Please provide a valid 10-digit Nigerian NUBAN bank account number.");
      return;
    }

    if (!data.bankAccountName.trim()) {
      setError("Please provide the account holder name matching your bank records.");
      return;
    }

    // Ensure data is saved to backend before navigating
    await saveStepData(4);
    // Proceed directly to Review & Submit KYC! (No initial draft listing!)
    router.push("/host/onboarding/review");
  };

  const getDocTypeLabel = () => {
    if (data.hostType === "company") return "CAC Certificate or Company Mandate Letter";
    if (data.hostType === "property_manager") return "Management Agreement or Signed Mandate";
    return "Deed of Assignment, C of O, or Electricity Utility Bill";
  };

  const urlLower = (data.authorityDocUrl || "").toLowerCase();
  const isDocOrPdf =
    urlLower.includes("application/pdf") ||
    urlLower.includes("word") ||
    urlLower.endsWith(".pdf") ||
    urlLower.endsWith(".doc") ||
    urlLower.endsWith(".docx");

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, title: "", url: "" })}
        title={previewModal.title}
        url={previewModal.url}
      />

      <div className="mb-8">
        <span className="text-[11px] font-bold text-[#0B5D45] uppercase tracking-widest bg-[#EDF5F2] px-3 py-1 rounded-full border border-[#0B5D45]/15">
          Stage 4 of 4 • Authority &amp; Bank Payouts
        </span>
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mt-3 mb-2">
          Ownership authority &amp; Nigerian bank
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Provide documentation proving your right to host, and your Nigerian bank account for automated reservation disbursements.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleContinue} className="space-y-6">
        {/* Authority Document Upload Card */}
        <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck size={18} className="text-[#0B5D45]" />
            <h3 className="text-[14px] font-semibold text-[#171717]">
              {getDocTypeLabel()}
            </h3>
          </div>
          <p className="text-[12.5px] text-[#6B6B67]">
            Upload an official document proving ownership or your legal authorization to lease this property.
          </p>

          <div
            onClick={handleTriggerUpload}
            className={`h-40 rounded-xl border-2 border-dashed relative flex flex-col items-center justify-center p-4 text-center transition-all cursor-pointer overflow-hidden ${
              data.authorityDocUrl
                ? "border-[#0B5D45] bg-[#F4F7F5]"
                : "border-[#E7E5E0] bg-white hover:border-[#0B5D45]"
            }`}
          >
            {uploadingDoc ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                <span className="text-xs text-[#0B5D45] font-medium">Compressing &amp; uploading...</span>
              </div>
            ) : data.authorityDocUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-between p-1">
                {/* Thumbnail / Document indicator */}
                <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                  {isDocOrPdf ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0B5D45]">
                      <FileText size={24} />
                      <span>{urlLower.endsWith(".doc") || urlLower.endsWith(".docx") ? "Word Document Attached" : "Document Attached (PDF)"}</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.authorityDocUrl}
                      alt="Authority Document"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="w-full flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1"
                  >
                    <Eye size={13} />
                    <span>Preview Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveDoc}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Upload size={24} className="text-[#8B8B86] mb-2" />
                <span className="text-xs font-semibold text-[#171717]">Upload Authority Document (Max 15MB)</span>
                <span className="text-[11px] text-[#8B8B86] mt-0.5">Deed, C of O, Management Agreement, or Utility Bill (PDF, DOC/DOCX, Images up to 15MB)</span>
              </>
            )}
          </div>
        </div>

        {/* Bank Account Details */}
        <div className="p-5 rounded-2xl bg-white border border-[#E7E5E0] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E7E5E0] pb-3">
            <CreditCard size={18} className="text-[#0B5D45]" />
            <h3 className="text-[14px] font-semibold text-[#171717]">
              Nigerian Bank Account for Guest Payouts
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-semibold text-[#171717]">Bank Name</label>
                <span className="text-[12px] text-[#8B8B86]">Commercial / MFB</span>
              </div>
              <select
                value={data.bankName}
                onChange={(e) => updateData({ bankName: e.target.value })}
                className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all cursor-pointer"
              >
                {NIGERIAN_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-semibold text-[#171717]">10-Digit Account Number</label>
                  <span className="text-[12px] text-[#8B8B86]">NUBAN</span>
                </div>
                <input
                  type="text"
                  maxLength={10}
                  value={data.bankAccountNumber}
                  onChange={(e) => updateData({ bankAccountNumber: e.target.value.replace(/\D/g, "") })}
                  placeholder="0123456789"
                  required
                  className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-semibold text-[#171717]">Account Holder Name</label>
                  <span className="text-[12px] text-[#8B8B86]">As on bank statement</span>
                </div>
                <input
                  type="text"
                  value={data.bankAccountName}
                  onChange={(e) => updateData({ bankAccountName: e.target.value })}
                  placeholder="e.g. Chukwuma Adeleke"
                  required
                  className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-4 border-t border-[#E7E5E0] flex items-center justify-between gap-4">
          <Link
            href="/host/onboarding/identity"
            className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Identity</span>
          </Link>

          <button
            type="submit"
            className="h-[50px] px-7 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <span>Review &amp; Submit KYC</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
