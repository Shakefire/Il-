"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Camera,
  FileText,
  Loader2,
  Eye,
  RotateCw,
  ScanFace,
  CreditCard,
  FileUp,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { compressFile } from "@/lib/imageCompression";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";
import FintechLivenessModal, { preloadLivenessEngine } from "@/components/FintechLivenessModal";
import StepMotion from "@/components/onboarding/StepMotion";

interface IdDocConfig {
  id: "nin" | "drivers_license" | "passport" | "voters_card";
  label: string;
  helper: string;
  icon: typeof FileText;
  inputLabel: string;
  inputPlaceholder: string;
  inputHelp: string;
  frontLabel: string;
  backLabel?: string;
  hideBackDoc?: boolean;
}

const ID_CONFIGS: IdDocConfig[] = [
  {
    id: "nin",
    label: "National Identification Number (NIN)",
    helper: "NIMC NIN Slip or Digital NIN Card",
    icon: FileText,
    inputLabel: "11-Digit National Identification Number (NIN)",
    inputPlaceholder: "e.g. 12345678901",
    inputHelp: "Enter your 11-digit NIN exactly as registered with NIMC.",
    frontLabel: "Front of NIN Slip or Card",
    backLabel: "Back of NIN Card (Optional)",
    hideBackDoc: false,
  },
  {
    id: "drivers_license",
    label: "Driver's Licence (FRSC)",
    helper: "Valid Nigerian Driver's Licence issued by FRSC",
    icon: CreditCard,
    inputLabel: "Driver's Licence Number",
    inputPlaceholder: "e.g. ABC123456789",
    inputHelp: "Enter your alphanumeric licence number issued by FRSC.",
    frontLabel: "Front of Driver's Licence",
    backLabel: "Back of Driver's Licence",
    hideBackDoc: false,
  },
  {
    id: "passport",
    label: "International Passport",
    helper: "Data page of valid Nigerian Passport",
    icon: FileText,
    inputLabel: "Passport Number",
    inputPlaceholder: "e.g. A12345678",
    inputHelp: "Enter the alphanumeric passport number from top right of bio-data page.",
    frontLabel: "Passport Bio-Data Page",
    backLabel: undefined,
    hideBackDoc: true,
  },
  {
    id: "voters_card",
    label: "Voter's Card (INEC PVC)",
    helper: "Permanent Voter's Card issued by INEC",
    icon: CreditCard,
    inputLabel: "Voter Identification Number (VIN)",
    inputPlaceholder: "e.g. 90F1B23456789012345",
    inputHelp: "Enter the 19-digit VIN located on the front of your card.",
    frontLabel: "Front of Voter Card",
    backLabel: "Back of Voter Card (Optional)",
    hideBackDoc: false,
  },
];

const ONBOARDING_STEPS = [
  { step: 1, label: "Host Type", href: "/host/onboarding/business-type" },
  { step: 2, label: "Profile", href: "/host/onboarding/profile" },
  { step: 3, label: "Identity", href: "/host/onboarding/identity" },
  { step: 4, label: "Authority & Payout", href: "/host/onboarding/authority" },
  { step: 5, label: "Listing Draft", href: "/host/onboarding/review" },
];

export default function IdentityStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();

  const [isNavigating, setIsNavigating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Field validation errors & touched states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Drag over states
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);

  // Modal preview state
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; title: string; url: string }>({
    isOpen: false,
    title: "",
    url: "",
  });

  // Fintech Biometric Liveness Modal state
  const [isLivenessModalOpen, setIsLivenessModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetField, setTargetField] = useState<"idFrontUrl" | "idBackUrl" | "selfieUrl">("idFrontUrl");

  const selectedDocConfig = ID_CONFIGS.find((c) => c.id === data.idType) || ID_CONFIGS[0];

  useEffect(() => {
    preloadLivenessEngine().catch(() => null);
  }, []);

  const validateIdNumber = (numStr: string, docType: string): string | null => {
    const trimmed = numStr.trim();
    if (!trimmed) return "Document identification number is required.";

    if (docType === "nin") {
      const digitsOnly = trimmed.replace(/\D/g, "");
      if (digitsOnly.length !== 11) {
        return "National Identification Number (NIN) must be exactly 11 digits.";
      }
    } else if (docType === "drivers_license") {
      if (trimmed.length < 8) {
        return "Please enter a valid driver's license number (minimum 8 characters).";
      }
    } else if (docType === "passport") {
      if (trimmed.length < 7) {
        return "Please enter a valid passport number (e.g. A12345678).";
      }
    } else if (docType === "voters_card") {
      if (trimmed.length < 10) {
        return "Please enter a valid voter identification number.";
      }
    }
    return null;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    const newErrors = { ...errors };

    if (field === "idNumber") {
      const numErr = validateIdNumber(data.idNumber || "", data.idType || "nin");
      if (numErr) {
        newErrors.idNumber = numErr;
      } else {
        delete newErrors.idNumber;
      }
    }

    if (field === "idFrontUrl") {
      if (!data.idFrontUrl) {
        newErrors.idFrontUrl = `Please upload the ${selectedDocConfig.frontLabel.toLowerCase()}.`;
      } else {
        delete newErrors.idFrontUrl;
      }
    }

    if (field === "selfieUrl") {
      if (!data.selfieUrl) {
        newErrors.selfieUrl = "Please complete the biometric face verification.";
      } else {
        delete newErrors.selfieUrl;
      }
    }

    setErrors(newErrors);
  };

  const handleSelectDocType = (docId: IdDocConfig["id"]) => {
    updateData({ idType: docId, idNumber: "" });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.idNumber;
      delete next.idFrontUrl;
      return next;
    });
  };

  const handleTriggerUpload = (field: "idFrontUrl" | "idBackUrl" | "selfieUrl") => {
    setTargetField(field);
    if (fileInputRef.current) {
      if (field === "selfieUrl") {
        fileInputRef.current.accept = "image/*";
      } else {
        fileInputRef.current.accept =
          "image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const processAndUploadFile = async (file: File, field: "idFrontUrl" | "idBackUrl" | "selfieUrl") => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        [field]: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 15MB limit. Please upload a smaller file.`,
      }));
      return;
    }

    setUploadingField(field);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    try {
      const compressedDataUrl = await compressFile(file);
      try {
        const res = await api.uploadImage(compressedDataUrl, "kyc");
        const url = res.url || compressedDataUrl;
        updateData({ [field]: url });
      } catch {
        updateData({ [field]: compressedDataUrl });
      }
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        [field]: err.message || "Failed to process image. Please try again.",
      }));
    } finally {
      setUploadingField(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processAndUploadFile(file, targetField);
    }
  };

  const handleDrop = async (e: React.DragEvent, field: "idFrontUrl" | "idBackUrl") => {
    e.preventDefault();
    e.stopPropagation();
    if (field === "idFrontUrl") setIsDraggingFront(false);
    if (field === "idBackUrl") setIsDraggingBack(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processAndUploadFile(file, field);
    }
  };

  const handleRemoveField = (field: "idFrontUrl" | "idBackUrl" | "selfieUrl", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateData({ [field]: "" });
  };

  const handleOpenPreview = (title: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewModal({ isOpen: true, title, url });
  };

  const handleSkipToDashboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSavingDraft(true);
    try {
      await saveStepData(3);
    } catch {
      // background save
    } finally {
      setIsSavingDraft(false);
      router.push("/host/dashboard");
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      idNumber: true,
      idFrontUrl: true,
      selfieUrl: true,
    });

    const currentErrors: Record<string, string> = {};

    const numErr = validateIdNumber(data.idNumber || "", data.idType || "nin");
    if (numErr) {
      currentErrors.idNumber = numErr;
    }

    if (!data.idFrontUrl) {
      currentErrors.idFrontUrl = `Please upload the ${selectedDocConfig.frontLabel.toLowerCase()}.`;
    }

    if (!data.selfieUrl) {
      currentErrors.selfieUrl = "Please complete face verification.";
    }

    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      return;
    }

    setIsNavigating(true);
    try {
      await saveStepData(3);
    } catch {
      // background save
    }
    router.push("/host/onboarding/authority");
  };

  const isDocOrPdf = (url?: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes("application/pdf") ||
      lower.includes("word") ||
      lower.endsWith(".pdf") ||
      lower.endsWith(".doc") ||
      lower.endsWith(".docx")
    );
  };

  return (
    <StepMotion className="w-full">
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

      {/* Fintech Biometric Liveness Modal */}
      <FintechLivenessModal
        isOpen={isLivenessModalOpen}
        onClose={() => setIsLivenessModalOpen(false)}
        onComplete={(result) => {
          updateData({ selfieUrl: result.snapshotUrl });
          setErrors((prev) => {
            const next = { ...prev };
            delete next.selfieUrl;
            return next;
          });
        }}
      />

      {/* 5-Step Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium text-[#4B5563] mb-2.5">
          <span className="uppercase tracking-wider text-[11px] font-semibold text-[#065F46]">
            Step 3 of 5 • Identity Verification
          </span>
          <span className="text-[12px] text-[#6B7280]">
            60% completed
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2" role="progressbar" aria-valuenow={60} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding Progress">
          {ONBOARDING_STEPS.map((s) => (
            <div
              key={s.step}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s.step <= 3 ? "bg-[#065F46]" : "bg-[#E5E7EB]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Page Introduction */}
      <div className="mb-8 sm:mb-10">
        <h1 className="font-serif text-[30px] sm:text-[36px] lg:text-[40px] font-normal tracking-tight text-[#111827] leading-[1.15]">
          Verify your identity
        </h1>
        <p className="mt-2 text-[15px] sm:text-[16px] text-[#4B5563] leading-relaxed max-w-2xl">
          Select your Nigerian ID, upload clear photos, and complete a quick face verification.
        </p>
      </div>

      <form onSubmit={handleContinue} noValidate className="space-y-10">
        {/* Two-Column Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-14 items-start">
          
          {/* ────────────────────────────────────────────────────────── */}
          {/* Left Column — Identity Details (~42% content width)        */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="pb-2.5 border-b border-[#E5E7EB]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                Identity Details
              </h2>
            </div>

            {/* 1. Identity Document Selector */}
            <div>
              <label htmlFor="idTypeSelect" className="block text-xs font-semibold text-[#111827] mb-1.5">
                Document Type <span className="text-[#065F46]">*</span>
              </label>
              <div className="relative">
                <select
                  id="idTypeSelect"
                  value={data.idType || "nin"}
                  onChange={(e) => handleSelectDocType(e.target.value as IdDocConfig["id"])}
                  className="w-full h-11 px-3.5 pr-10 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white text-sm text-[#111827] font-medium focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 outline-none appearance-none cursor-pointer transition-colors duration-150"
                >
                  {ID_CONFIGS.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="text-[#6B7280] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                />
              </div>
              <p className="mt-1.5 text-[12px] text-[#6B7280] leading-relaxed">
                {selectedDocConfig.helper}
              </p>
            </div>

            {/* 2. Document Identification Number */}
            <div>
              <label htmlFor="idNumber" className="block text-xs font-semibold text-[#111827] mb-1.5">
                {selectedDocConfig.inputLabel} <span className="text-[#065F46]">*</span>
              </label>
              <input
                id="idNumber"
                type="text"
                value={data.idNumber || ""}
                onChange={(e) => {
                  updateData({ idNumber: e.target.value });
                  if (errors.idNumber) validateField("idNumber");
                }}
                onBlur={() => handleBlur("idNumber")}
                placeholder={selectedDocConfig.inputPlaceholder}
                aria-required="true"
                aria-invalid={Boolean(touched.idNumber && errors.idNumber)}
                aria-describedby={touched.idNumber && errors.idNumber ? "idNumber-error" : "idNumber-helper"}
                className={`w-full h-11 px-3.5 rounded-lg border text-sm bg-white outline-none font-mono tracking-wider transition-colors duration-150 ${
                  touched.idNumber && errors.idNumber
                    ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                    : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                }`}
              />
              {touched.idNumber && errors.idNumber ? (
                <p id="idNumber-error" role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{errors.idNumber}</span>
                </p>
              ) : (
                <p id="idNumber-helper" className="mt-1.5 text-[12px] text-[#6B7280] leading-relaxed">
                  {selectedDocConfig.inputHelp}
                </p>
              )}
            </div>

            {/* Helpful Guidance & Security Commitment */}
            <div className="pt-4 border-t border-[#E5E7EB]/70">
              <div className="p-3.5 rounded-lg bg-[#FAFAF8] border border-[#E5E7EB] flex items-start gap-2.5">
                <ShieldCheck size={18} className="text-[#065F46] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#4B5563] leading-relaxed">
                  We use your ID to verify your identity before you host. Your details are kept private and secure.
                </p>
              </div>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Right Column — Documents & Biometrics (~58% content width) */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-6">
            <div className="pb-2.5 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                ID photos &amp; face check
              </h2>
              <span className="text-[11px] text-[#6B7280] font-normal">
                Max 15MB • PDF, JPG, PNG
              </span>
            </div>

            {/* A. Document Uploads (Side by side on desktop) */}
            <div className={`grid gap-4 ${selectedDocConfig.hideBackDoc ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
              {/* Front ID Dropzone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#111827]">
                    {selectedDocConfig.frontLabel} <span className="text-[#065F46]">*</span>
                  </span>
                  {data.idFrontUrl && (
                    <span className="text-[11px] font-medium text-[#065F46] flex items-center gap-1">
                      <Check size={12} strokeWidth={2.5} /> Attached
                    </span>
                  )}
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTriggerUpload("idFrontUrl")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTriggerUpload("idFrontUrl");
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFront(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingFront(false);
                  }}
                  onDrop={(e) => handleDrop(e, "idFrontUrl")}
                  className={`h-44 rounded-xl border-2 border-dashed relative flex flex-col items-center justify-center p-3 text-center transition-all duration-150 cursor-pointer overflow-hidden ${
                    touched.idFrontUrl && errors.idFrontUrl
                      ? "border-rose-400 bg-rose-50/20"
                      : isDraggingFront
                      ? "border-[#065F46] bg-[#F4F7F5]"
                      : data.idFrontUrl
                      ? "border-[#065F46]/35 bg-[#FAFAF8]"
                      : "border-[#D1D5DB] bg-white hover:border-[#9CA3AF] hover:bg-[#FAFAF8]"
                  }`}
                >
                  {uploadingField === "idFrontUrl" ? (
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 size={22} className="animate-spin text-[#065F46] mb-2" />
                      <span className="text-xs text-[#065F46] font-medium">Processing &amp; uploading...</span>
                    </div>
                  ) : data.idFrontUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-between p-1">
                      <div className="relative w-full h-26 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                        {isDocOrPdf(data.idFrontUrl) ? (
                          <div className="flex flex-col items-center justify-center p-2 text-center">
                            <FileText size={24} className="text-[#065F46] mb-1" />
                            <span className="text-xs font-semibold text-[#111827]">Document Attached</span>
                            <span className="text-[10px] text-[#6B7280]">PDF / Word Format</span>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={data.idFrontUrl}
                            alt="Front of ID"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}
                      </div>

                      <div className="w-full flex items-center justify-between pt-1.5 px-0.5 border-t border-[#E5E7EB]/60">
                        <button
                          type="button"
                          onClick={(e) => handleOpenPreview(selectedDocConfig.frontLabel, data.idFrontUrl, e)}
                          className="text-xs font-medium text-[#065F46] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye size={12} />
                          <span>Preview</span>
                        </button>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerUpload("idFrontUrl");
                            }}
                            className="text-xs font-medium text-[#4B5563] hover:text-[#111827] flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <RotateCw size={11} />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveField("idFrontUrl", e)}
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer transition-colors"
                          >
                            <Trash2 size={11} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <FileUp size={22} className="text-[#4B5563] mb-1.5" />
                      <span className="text-xs font-semibold text-[#111827]">Upload Front Photo</span>
                      <span className="text-[11px] text-[#6B7280] mt-0.5">Click to browse or drag and drop</span>
                    </>
                  )}
                </div>

                {touched.idFrontUrl && errors.idFrontUrl && (
                  <p role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errors.idFrontUrl}</span>
                  </p>
                )}
              </div>

              {/* Back ID Dropzone (Optional) */}
              {!selectedDocConfig.hideBackDoc && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#111827]">
                      {selectedDocConfig.backLabel || "Back of ID"} <span className="text-[#6B7280] font-normal">(Optional)</span>
                    </span>
                    {data.idBackUrl && (
                      <span className="text-[11px] font-medium text-[#065F46] flex items-center gap-1">
                        <Check size={12} strokeWidth={2.5} /> Attached
                      </span>
                    )}
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleTriggerUpload("idBackUrl")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleTriggerUpload("idBackUrl");
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingBack(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingBack(false);
                    }}
                    onDrop={(e) => handleDrop(e, "idBackUrl")}
                    className={`h-44 rounded-xl border-2 border-dashed relative flex flex-col items-center justify-center p-3 text-center transition-all duration-150 cursor-pointer overflow-hidden ${
                      isDraggingBack
                        ? "border-[#065F46] bg-[#F4F7F5]"
                        : data.idBackUrl
                        ? "border-[#065F46]/35 bg-[#FAFAF8]"
                        : "border-[#D1D5DB] bg-white hover:border-[#9CA3AF] hover:bg-[#FAFAF8]"
                    }`}
                  >
                    {uploadingField === "idBackUrl" ? (
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 size={22} className="animate-spin text-[#065F46] mb-2" />
                        <span className="text-xs text-[#065F46] font-medium">Processing &amp; uploading...</span>
                      </div>
                    ) : data.idBackUrl ? (
                      <div className="w-full h-full flex flex-col items-center justify-between p-1">
                        <div className="relative w-full h-26 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                          {isDocOrPdf(data.idBackUrl) ? (
                            <div className="flex flex-col items-center justify-center p-2 text-center">
                              <FileText size={24} className="text-[#065F46] mb-1" />
                              <span className="text-xs font-semibold text-[#111827]">Document Attached</span>
                              <span className="text-[10px] text-[#6B7280]">PDF / Word Format</span>
                            </div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={data.idBackUrl}
                              alt="Back of ID"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          )}
                        </div>

                        <div className="w-full flex items-center justify-between pt-1.5 px-0.5 border-t border-[#E5E7EB]/60">
                          <button
                            type="button"
                            onClick={(e) => handleOpenPreview(selectedDocConfig.backLabel || "Back of ID", data.idBackUrl, e)}
                            className="text-xs font-medium text-[#065F46] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye size={12} />
                            <span>Preview</span>
                          </button>
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTriggerUpload("idBackUrl");
                              }}
                              className="text-xs font-medium text-[#4B5563] hover:text-[#111827] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <RotateCw size={11} />
                              <span>Replace</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveField("idBackUrl", e)}
                              className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer transition-colors"
                            >
                              <Trash2 size={11} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FileUp size={22} className="text-[#4B5563] mb-1.5" />
                        <span className="text-xs font-semibold text-[#111827]">Upload Back Photo</span>
                        <span className="text-[11px] text-[#6B7280] mt-0.5">Optional for NIN slip / Voter Card</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* B. Biometric Liveness Verification (Directly beneath uploads) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                  Face verification <span className="text-[#065F46]">*</span>
                </span>
                {data.selfieUrl ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#EDF5F2] text-[#065F46] border border-[#065F46]/20 text-[11px] font-semibold flex items-center gap-1">
                    <Check size={12} strokeWidth={2.5} /> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 text-[#6B7280] text-[11px] font-medium">
                    Pending
                  </span>
                )}
              </div>

              {data.selfieUrl ? (
                /* Verified Biometric Panel */
                <div className="rounded-xl bg-[#F4F7F5] border border-[#065F46]/25 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.selfieUrl}
                        alt="Verified Photo"
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-[#065F46] ring-offset-2"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#065F46] text-white flex items-center justify-center shadow-xs">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#111827]">
                          Face verified
                        </h3>
                      </div>
                      <p className="text-xs text-[#4B5563] mt-0.5">
                        Your face scan was successful and matches your details.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenPreview("Verification Photo", data.selfieUrl, e)}
                      className="h-9 px-3 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#065F46] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLivenessModalOpen(true)}
                      className="h-9 px-3 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#111827] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCw size={12} />
                      <span>Rescan</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveField("selfieUrl", e)}
                      className="h-9 px-2.5 rounded-lg border border-transparent hover:border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 active:scale-[0.99] flex items-center gap-1 transition-all cursor-pointer"
                      title="Remove verified selfie"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unverified / Pending Biometric Panel */
                <div
                  className={`p-4 sm:p-5 rounded-xl border space-y-3.5 transition-all ${
                    touched.selfieUrl && errors.selfieUrl ? "border-rose-400 bg-rose-50/10" : "border-[#D1D5DB] bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#EDF5F2] text-[#065F46] flex items-center justify-center shrink-0 mt-0.5">
                      <ScanFace size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#111827]">
                        Face verification
                      </h3>
                      <p className="text-xs text-[#4B5563] mt-0.5 leading-relaxed">
                        Take a quick face scan using your camera to confirm you match your ID.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsLivenessModalOpen(true)}
                      className="flex-1 h-11 px-4 rounded-lg bg-[#065F46] hover:bg-[#044E39] active:scale-[0.99] text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                    >
                      <ScanFace size={16} />
                      <span>Start face verification</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerUpload("selfieUrl")}
                      className="h-11 px-3.5 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-xs sm:text-sm font-medium text-[#4B5563] hover:text-[#111827] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Upload headshot if camera is not available"
                    >
                      <Camera size={15} />
                      <span>Upload a photo instead</span>
                    </button>
                  </div>

                  {touched.selfieUrl && errors.selfieUrl && (
                    <p role="alert" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>{errors.selfieUrl}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* Navigation Action Hierarchy                                */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-[#E5E7EB] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Link
            href="/host/onboarding/profile"
            className="w-full sm:w-auto h-11 px-5 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to host details</span>
          </Link>

          <div className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSkipToDashboard}
              disabled={isSavingDraft || isNavigating}
              className="w-full sm:w-auto h-11 px-4 rounded-lg text-sm font-medium text-[#4B5563] hover:text-[#111827] hover:bg-stone-100 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isSavingDraft ? "Saving..." : "Skip for now"}
            </button>

            <button
              type="submit"
              disabled={isNavigating || isSavingDraft}
              className="w-full sm:w-auto h-11 px-7 rounded-lg bg-[#065F46] hover:bg-[#044E39] active:scale-[0.99] text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isNavigating ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Continue to property &amp; payout</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </StepMotion>
  );
}
