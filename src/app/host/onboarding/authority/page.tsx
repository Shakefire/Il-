"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ArrowRight,
  ArrowLeft,
  FileUp,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  RotateCw,
  Trash2,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { compressFile } from "@/lib/imageCompression";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";
import StepMotion from "@/components/onboarding/StepMotion";

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

const ONBOARDING_STEPS = [
  { step: 1, label: "Host Type", href: "/host/onboarding/business-type" },
  { step: 2, label: "Profile", href: "/host/onboarding/profile" },
  { step: 3, label: "Identity", href: "/host/onboarding/identity" },
  { step: 4, label: "Authority & Payout", href: "/host/onboarding/authority" },
  { step: 5, label: "Listing Draft", href: "/host/onboarding/review" },
];

export default function AuthorityStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();

  const [isNavigating, setIsNavigating] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Field validation errors & touched states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Document preview modal
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
  }>({
    isOpen: false,
    title: "",
    url: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize authorityDocType to "utility_bill"
  useEffect(() => {
    if (!data.authorityDocType || data.authorityDocType !== "utility_bill") {
      updateData({ authorityDocType: "utility_bill" });
    }
  }, [data.authorityDocType, updateData]);

  // Validation functions
  const validateField = (field: string) => {
    const newErrors = { ...errors };

    if (field === "authorityDocUrl") {
      if (!data.authorityDocUrl) {
        newErrors.authorityDocUrl = "Please upload a recent water or electricity bill showing the property's address.";
      } else {
        delete newErrors.authorityDocUrl;
      }
    }

    if (field === "bankName") {
      if (!data.bankName) {
        newErrors.bankName = "Please select your Nigerian bank.";
      } else {
        delete newErrors.bankName;
      }
    }

    if (field === "bankAccountNumber") {
      const cleaned = (data.bankAccountNumber || "").replace(/\D/g, "");
      if (!cleaned) {
        newErrors.bankAccountNumber = "10-digit account number is required.";
      } else if (cleaned.length !== 10) {
        newErrors.bankAccountNumber = "Nigerian NUBAN account numbers must be exactly 10 digits.";
      } else {
        delete newErrors.bankAccountNumber;
      }
    }

    if (field === "bankAccountName") {
      if (!data.bankAccountName || data.bankAccountName.trim().length < 3) {
        newErrors.bankAccountName = "Please enter the account holder name registered with your bank.";
      } else {
        delete newErrors.bankAccountName;
      }
    }

    setErrors(newErrors);
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        authorityDocUrl: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 15MB limit. Please choose a smaller file.`,
      }));
      setTouched((prev) => ({ ...prev, authorityDocUrl: true }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingDoc(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.authorityDocUrl;
      return next;
    });

    try {
      const compressedDataUrl = await compressFile(file);

      try {
        const res = await api.uploadImage(compressedDataUrl, "authority");
        const url = res.url || compressedDataUrl;
        updateData({ authorityDocUrl: url, authorityDocType: "utility_bill" });
      } catch {
        // Fallback to compressed data URL if remote upload endpoint fails
        updateData({ authorityDocUrl: compressedDataUrl, authorityDocType: "utility_bill" });
      }

      setTouched((prev) => ({ ...prev, authorityDocUrl: true }));
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        authorityDocUrl: err.message || "Failed to process document file. Please select another image or PDF.",
      }));
      setTouched((prev) => ({ ...prev, authorityDocUrl: true }));
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleRemoveDoc = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateData({ authorityDocUrl: "" });
    setTouched((prev) => ({ ...prev, authorityDocUrl: true }));
    setErrors((prev) => ({
      ...prev,
      authorityDocUrl: "Please upload a recent water or electricity bill showing the property's address.",
    }));
  };

  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewModal({
      isOpen: true,
      title: "Property Utility Bill",
      url: data.authorityDocUrl,
    });
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      authorityDocUrl: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
    });

    const currentErrors: Record<string, string> = {};

    if (!data.authorityDocUrl) {
      currentErrors.authorityDocUrl = "Please upload a recent water or electricity bill showing the property's address.";
    }

    if (!data.bankName) {
      currentErrors.bankName = "Please select your payout bank.";
    }

    const nubanClean = (data.bankAccountNumber || "").replace(/\D/g, "");
    if (!nubanClean) {
      currentErrors.bankAccountNumber = "Account number is required.";
    } else if (nubanClean.length !== 10) {
      currentErrors.bankAccountNumber = "Nigerian NUBAN account numbers must be exactly 10 digits.";
    }

    if (!data.bankAccountName || data.bankAccountName.trim().length < 3) {
      currentErrors.bankAccountName = "Please enter the account holder name registered with your bank.";
    }

    setErrors(currentErrors);

    if (Object.keys(currentErrors).length > 0) {
      return;
    }

    setIsNavigating(true);
    try {
      await saveStepData(4);
      router.push("/host/onboarding/review");
    } catch {
      setIsNavigating(false);
    }
  };

  const urlLower = (data.authorityDocUrl || "").toLowerCase();
  const isDocOrPdf =
    urlLower.includes("application/pdf") ||
    urlLower.includes("word") ||
    urlLower.endsWith(".pdf") ||
    urlLower.endsWith(".doc") ||
    urlLower.endsWith(".docx");

  return (
    <StepMotion className="w-full max-w-[540px] mx-auto pb-10">
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

      {/* 5-Step Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium text-[#4B5563] mb-2.5">
          <span className="uppercase tracking-wider text-[11px] font-semibold text-[#065F46]">
            Step 4 of 5 • Property &amp; Payout
          </span>
          <span className="text-[12px] text-[#6B7280]">
            80% completed
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2" role="progressbar" aria-valuenow={80} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding Progress">
          {ONBOARDING_STEPS.map((s) => (
            <div
              key={s.step}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s.step <= 4 ? "bg-[#065F46]" : "bg-[#E5E7EB]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Page Introduction */}
      <div className="mb-8">
        <h1 className="font-serif text-[28px] sm:text-[32px] font-normal tracking-tight text-[#111827] leading-[1.18]">
          Property &amp; payout details
        </h1>
        <p className="mt-2 text-[14px] sm:text-[15px] text-[#4B5563] leading-relaxed">
          Provide a recent utility bill for the property and your Nigerian bank account for payouts.
        </p>
      </div>

      <form onSubmit={handleContinue} noValidate className="space-y-8">
        {/* ────────────────────────────────────────────────────────── */}
        {/* 1. Property Utility Bill Upload                             */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                Property Utility Bill <span className="text-[#065F46]">*</span>
              </h2>
              <span className="text-[11px] text-[#6B7280]">
                Max 15MB • PDF, JPG, PNG
              </span>
            </div>
            <p className="text-[13px] text-[#4B5563] mt-1 leading-relaxed">
              Upload a recent water or electricity bill showing the property&apos;s address.
            </p>
          </div>

          {/* Single Compact Upload Control */}
          <div
            role="button"
            tabIndex={0}
            onClick={!data.authorityDocUrl ? handleTriggerUpload : undefined}
            onKeyDown={(e) => {
              if (!data.authorityDocUrl && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handleTriggerUpload();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`min-h-[148px] rounded-xl border-2 border-dashed relative flex flex-col items-center justify-center p-4 text-center transition-all duration-150 ${
              uploadingDoc
                ? "border-[#065F46] bg-[#F4F7F5]"
                : data.authorityDocUrl
                ? "border-[#065F46]/35 bg-[#FAFAF8]"
                : isDragOver
                ? "border-[#065F46] bg-[#F4F7F5]"
                : touched.authorityDocUrl && errors.authorityDocUrl
                ? "border-rose-400 bg-rose-50/20 cursor-pointer"
                : "border-[#D1D5DB] bg-white hover:border-[#9CA3AF] hover:bg-[#FAFAF8] cursor-pointer"
            }`}
          >
            {uploadingDoc ? (
              <div className="flex flex-col items-center justify-center py-2">
                <Loader2 size={22} className="animate-spin text-[#065F46] mb-2" />
                <span className="text-xs text-[#065F46] font-medium">Processing &amp; uploading...</span>
                <span className="text-[11px] text-[#6B7280] mt-0.5">Optimizing file for verification</span>
              </div>
            ) : data.authorityDocUrl ? (
              <div className="w-full flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-13 h-13 rounded-lg overflow-hidden bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                    {isDocOrPdf ? (
                      <FileText size={22} className="text-[#065F46]" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.authorityDocUrl}
                        alt="Property Utility Bill"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#111827] truncate">
                        Utility Bill Attached
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#065F46] bg-[#EDF5F2] px-1.5 py-0.5 rounded">
                        <Check size={10} strokeWidth={3} />
                        <span>Ready</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                      Water or electricity bill confirmed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className="h-8 px-2.5 rounded-md border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#065F46] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Eye size={12} />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerUpload();
                    }}
                    className="h-8 px-2.5 rounded-md border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#4B5563] hover:text-[#111827] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <RotateCw size={11} />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveDoc}
                    className="h-8 w-8 rounded-md border border-transparent hover:border-rose-200 text-rose-600 hover:bg-rose-50 active:scale-[0.99] flex items-center justify-center transition-all cursor-pointer"
                    title="Remove attached document"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <FileUp size={22} className="text-[#4B5563] mb-1.5" />
                <span className="text-xs font-semibold text-[#111827]">
                  Upload Utility Bill
                </span>
                <span className="text-[12px] text-[#6B7280] mt-0.5">
                  Water or electricity bill
                </span>
                <span className="text-[11px] text-[#9CA3AF] mt-1">
                  Click to browse or drag and drop
                </span>
              </div>
            )}
          </div>

          {touched.authorityDocUrl && errors.authorityDocUrl && (
            <p role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle size={13} className="shrink-0" />
              <span>{errors.authorityDocUrl}</span>
            </p>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* 2. Payout Account Section                                  */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-[#E5E7EB] space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
              Payout Account
            </h2>
            <p className="text-[13px] text-[#4B5563] mt-1 leading-relaxed">
              Enter the bank account where you want to receive guest payouts.
            </p>
          </div>

          <div className="space-y-4">
            {/* Field 1: Bank Name Selector (Full width) */}
            <div>
              <label htmlFor="bankName" className="block text-xs font-semibold text-[#111827] mb-1.5">
                Bank Name <span className="text-[#065F46]">*</span>
              </label>
              <div className="relative">
                <select
                  id="bankName"
                  value={data.bankName || "Guaranty Trust Bank (GTBank)"}
                  onChange={(e) => {
                    updateData({ bankName: e.target.value });
                    if (errors.bankName) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.bankName;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => handleBlur("bankName")}
                  className="w-full h-11 px-3.5 pr-10 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white text-sm text-[#111827] font-medium focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 outline-none appearance-none cursor-pointer transition-colors duration-150"
                >
                  <option value="" disabled>Select your bank</option>
                  {NIGERIAN_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="text-[#6B7280] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                />
              </div>

              {touched.bankName && errors.bankName && (
                <p role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{errors.bankName}</span>
                </p>
              )}
            </div>

            {/* Field 2 & 3: Account Number & Account Holder Name (2-column on desktop, stacked on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Account Number */}
              <div>
                <label htmlFor="bankAccountNumber" className="block text-xs font-semibold text-[#111827] mb-1.5">
                  10-Digit Account Number <span className="text-[#065F46]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="bankAccountNumber"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={data.bankAccountNumber || ""}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, "");
                      updateData({ bankAccountNumber: cleaned });
                      if (cleaned.length === 10 && errors.bankAccountNumber) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.bankAccountNumber;
                          return next;
                        });
                      }
                    }}
                    onBlur={() => handleBlur("bankAccountNumber")}
                    placeholder="e.g. 0123456789"
                    aria-required="true"
                    aria-invalid={Boolean(touched.bankAccountNumber && errors.bankAccountNumber)}
                    className={`w-full h-11 px-3.5 rounded-lg border text-sm bg-white outline-none font-mono tracking-wider transition-colors duration-150 ${
                      touched.bankAccountNumber && errors.bankAccountNumber
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                        : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                    }`}
                  />
                  {data.bankAccountNumber && data.bankAccountNumber.length === 10 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-[#065F46] text-white flex items-center justify-center shadow-xs animate-in fade-in zoom-in-90 duration-150">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>

                {touched.bankAccountNumber && errors.bankAccountNumber ? (
                  <p role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errors.bankAccountNumber}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    10-digit Nigerian NUBAN
                  </p>
                )}
              </div>

              {/* Account Holder Name */}
              <div>
                <label htmlFor="bankAccountName" className="block text-xs font-semibold text-[#111827] mb-1.5">
                  Account Holder Name <span className="text-[#065F46]">*</span>
                </label>
                <input
                  id="bankAccountName"
                  type="text"
                  value={data.bankAccountName || ""}
                  onChange={(e) => {
                    updateData({ bankAccountName: e.target.value });
                    if (e.target.value.trim().length >= 3 && errors.bankAccountName) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.bankAccountName;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => handleBlur("bankAccountName")}
                  placeholder="e.g. Chukwuma Adeleke"
                  aria-required="true"
                  aria-invalid={Boolean(touched.bankAccountName && errors.bankAccountName)}
                  className={`w-full h-11 px-3.5 rounded-lg border text-sm bg-white outline-none transition-colors duration-150 ${
                    touched.bankAccountName && errors.bankAccountName
                      ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                      : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                  }`}
                />

                {touched.bankAccountName && errors.bankAccountName ? (
                  <p role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errors.bankAccountName}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    As registered with your bank
                  </p>
                )}
              </div>
            </div>

            {/* Quiet Payout Notice */}
            <div className="pt-2 flex items-start gap-2 text-[12px] text-[#6B7280]">
              <ShieldCheck size={16} className="text-[#065F46] shrink-0 mt-0.5" />
              <span>Payouts are sent to this account within 24 hours after a guest checks in.</span>
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* 3. Persistent Bottom Action Area                           */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-[#E5E7EB] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Link
            href="/host/onboarding/identity"
            className="w-full sm:w-auto h-11 px-5 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to identity</span>
          </Link>

          <button
            type="submit"
            disabled={isNavigating || uploadingDoc}
            className="w-full sm:w-auto h-11 px-7 rounded-lg bg-[#065F46] hover:bg-[#044E39] active:scale-[0.99] text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isNavigating ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Saving details...</span>
              </>
            ) : (
              <>
                <span>Review your details</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </StepMotion>
  );
}
