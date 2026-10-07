"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Camera,
  FileText,
  Loader2,
  Eye,
  RotateCw,
  ScanFace,
  ChevronDown,
  CreditCard,
  FileUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { compressFile } from "@/lib/imageCompression";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";
import FintechLivenessModal, { preloadLivenessEngine } from "@/components/FintechLivenessModal";

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
    id: "passport",
    label: "International Passport",
    helper: "Data page of valid Nigerian Passport",
    icon: FileText,
    inputLabel: "Passport Number",
    inputPlaceholder: "e.g. A12345678",
    inputHelp: "Enter the alphanumeric passport number from the top right of your bio-data page",
    frontLabel: "Upload Passport Data Page *",
    hideBackDoc: true,
  },
  {
    id: "drivers_license",
    label: "Driver's Licence (FRSC)",
    helper: "Valid Nigerian Driver's Licence",
    icon: CreditCard,
    inputLabel: "Driver's Licence Number",
    inputPlaceholder: "e.g. ABC123456789",
    inputHelp: "Enter your valid alphanumeric Federal Road Safety Corps licence number",
    frontLabel: "Upload Front of Licence *",
    backLabel: "Upload Back of Licence",
    hideBackDoc: false,
  },
  {
    id: "nin",
    label: "National Identification Number (NIN)",
    helper: "NIN Slip or Digital NIN Card",
    icon: FileText,
    inputLabel: "11-Digit National Identification Number (NIN)",
    inputPlaceholder: "e.g. 12345678901",
    inputHelp: "Enter your 11-digit NIN exactly as issued by NIMC",
    frontLabel: "Upload Front of NIN Slip / Card *",
    backLabel: "Upload Back of NIN (Optional)",
    hideBackDoc: false,
  },
  {
    id: "voters_card",
    label: "Voter's Card (INEC PVC)",
    helper: "Permanent Voter's Card",
    icon: CreditCard,
    inputLabel: "Voter Identification Number (VIN)",
    inputPlaceholder: "e.g. 90F1B23456789012345",
    inputHelp: "Enter the 19-digit VIN located on the front of your voter card",
    frontLabel: "Upload Front of Voter Card *",
    backLabel: "Upload Back of Voter Card (Optional)",
    hideBackDoc: false,
  },
];

export default function IdentityStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Drag over states for interactive dropzones
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Preload neural vision engine in background for instant camera startup
  useEffect(() => {
    preloadLivenessEngine().catch(() => null);
  }, []);

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

  const handleSelectDocType = (docId: IdDocConfig["id"]) => {
    updateData({ idType: docId });
    setIsDropdownOpen(false);
    setError(null);
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
      fileInputRef.current.click();
    }
  };

  const processAndUploadFile = async (file: File, field: "idFrontUrl" | "idBackUrl" | "selfieUrl") => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB limit. Please upload a file up to 15MB.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingField(field);
    setError(null);

    try {
      // 1. Process & compress file
      const compressedDataUrl = await compressFile(file);

      // 2. Upload to storage API
      try {
        const res = await api.uploadImage(compressedDataUrl, "kyc");
        const url = res.url || compressedDataUrl;
        updateData({ [field]: url });
      } catch {
        // Fall back to processed data URL
        updateData({ [field]: compressedDataUrl });
      }
    } catch (err: any) {
      setError(err.message || "Failed to process file. Please choose another file.");
    } finally {
      setUploadingField(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.idType) {
      setError("Please select an identity document type.");
      return;
    }

    if (!data.idNumber.trim()) {
      setError(`Please provide your ${selectedDocConfig.inputLabel.toLowerCase()}.`);
      return;
    }

    if (!data.idFrontUrl) {
      setError(`Please upload your ${selectedDocConfig.frontLabel.replace(" *", "").toLowerCase()}.`);
      return;
    }

    if (!data.selfieUrl) {
      setError("Please complete your facial biometric verification.");
      return;
    }

    setIsNavigating(true);
    // Ensure data is saved to backend before navigating
    await saveStepData(3).catch(() => null);
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

  const SelectedIcon = selectedDocConfig.icon;

  return (
    <div className="max-w-2xl mx-auto bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
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
        }}
      />

      {/* Header Block with Anchored Negative Space */}
      <div className="mb-10">
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mb-2">
          Verify your identity
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Select your valid Nigerian identity document, upload clear copies, and complete a real-time biometric check.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleContinue} className="space-y-6">
        {/* 1. Document Selection: The Dropdown Transformation */}
        <div className="space-y-2" ref={dropdownRef}>
          <label className="text-[13px] font-semibold text-[#171717] block">
            Select Identity Document
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="w-full min-h-[54px] px-4 py-3 bg-[#FAFAF8] hover:bg-white border border-[#E7E5E0] hover:border-[#D1CEC7] rounded-xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0B5D45]/15 focus:border-[#0B5D45]"
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0B5D45]/10 text-[#0B5D45] flex items-center justify-center shrink-0">
                  <SelectedIcon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[14.5px] font-semibold text-[#171717] block truncate leading-tight">
                    {selectedDocConfig.label}
                  </span>
                  <span className="text-[12px] text-[#8B8B86] block truncate mt-0.5">
                    {selectedDocConfig.helper}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="w-5 h-5 rounded-full bg-[#EDF5F2] text-[#0B5D45] flex items-center justify-center">
                  <Check size={12} strokeWidth={3} />
                </div>
                <ChevronDown
                  size={18}
                  className={`text-[#8B8B86] transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180 text-[#171717]" : ""
                  }`}
                />
              </div>
            </button>

            {/* Rich Dropdown Options Panel */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 inset-x-0 bg-white border border-[#E7E5E0] rounded-2xl shadow-xl z-30 p-1.5 space-y-1 overflow-hidden"
                  role="listbox"
                >
                  {ID_CONFIGS.map((doc) => {
                    const isSelected = doc.id === data.idType;
                    const Icon = doc.icon;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleSelectDocType(doc.id)}
                        className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#F4F7F5] text-[#171717]"
                            : "hover:bg-[#FAFAF8] text-[#171717]"
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-[#0B5D45] text-white"
                                : "bg-[#F0EFEA] text-[#6B6B67]"
                            }`}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[13.5px] font-semibold block leading-tight">
                              {doc.label}
                            </span>
                            <span className="text-[12px] text-[#8B8B86] block mt-0.5">
                              {doc.helper}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#0B5D45] text-white flex items-center justify-center shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 2. Refined ID Document Number Input */}
        <div className="space-y-1">
          <label className="text-[13px] font-semibold text-[#171717] block">
            {selectedDocConfig.inputLabel}
          </label>
          <input
            type="text"
            value={data.idNumber}
            onChange={(e) => updateData({ idNumber: e.target.value })}
            placeholder={selectedDocConfig.inputPlaceholder}
            required
            className="w-full h-[50px] px-4 bg-[#FAFAF8] focus:bg-white border border-[#E7E5E0] focus:border-[#0B5D45] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all font-mono"
          />
          <p className="text-[12px] text-[#8B8B86] pt-0.5">
            {selectedDocConfig.inputHelp}
          </p>
        </div>

        {/* 3. Dynamic, Context-Aware Upload Zones */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#171717] block">
              Required Document Upload
            </span>
            <span className="text-[11.5px] text-[#8B8B86]">Max 15MB • PDF, JPG, PNG, DOC</span>
          </div>

          <div
            className={`grid gap-4 ${
              selectedDocConfig.hideBackDoc ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {/* Front of ID / Passport Data Page Dropzone */}
            <div className="space-y-1.5">
              <span className="text-[12px] font-medium text-[#6B6B67] block">
                {selectedDocConfig.frontLabel}
              </span>
              <motion.div
                whileHover={{ scale: 1.015 }}
                animate={{
                  scale: isDraggingFront ? 1.03 : 1,
                  borderColor: isDraggingFront ? "#0B5D45" : undefined,
                }}
                transition={{ duration: 0.15 }}
                onClick={() => handleTriggerUpload("idFrontUrl")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFront(true);
                }}
                onDragLeave={() => setIsDraggingFront(false)}
                onDrop={(e) => handleDrop(e, "idFrontUrl")}
                className={`h-44 rounded-2xl border transition-all cursor-pointer relative flex flex-col items-center justify-center p-4 text-center overflow-hidden ${
                  isDraggingFront
                    ? "border-[#0B5D45] bg-[#0B5D45]/[0.06] ring-2 ring-[#0B5D45]/20"
                    : data.idFrontUrl
                    ? "border-[#0B5D45] bg-[#F4F7F5]"
                    : "border-[#E7E5E0] bg-[#0B5D45]/[0.02] hover:bg-[#0B5D45]/[0.045] hover:border-[#0B5D45]"
                }`}
              >
                {uploadingField === "idFrontUrl" ? (
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                    <span className="text-xs text-[#0B5D45] font-medium">Processing &amp; uploading...</span>
                  </div>
                ) : data.idFrontUrl ? (
                  <div className="w-full h-full flex flex-col items-center justify-between">
                    <div className="relative w-full h-24 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                      {isDocOrPdf(data.idFrontUrl) ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B5D45]">
                          <FileText size={20} />
                          <span>Document Attached</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={data.idFrontUrl}
                          alt="Front of ID"
                          className="w-full h-full object-cover rounded-xl"
                        />
                      )}
                    </div>

                    <div className="w-full flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={(e) => handleOpenPreview(selectedDocConfig.frontLabel, data.idFrontUrl, e)}
                        className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveField("idFrontUrl", e)}
                        className="text-xs text-[#8B8B86] hover:text-[#171717] underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#E7E5E0] text-[#0B5D45] flex items-center justify-center shadow-xs mb-2">
                      <FileUp size={20} />
                    </div>
                    <span className="text-xs font-semibold text-[#171717]">
                      {selectedDocConfig.frontLabel.replace(" *", "")}
                    </span>
                    <span className="text-[11px] text-[#8B8B86] mt-0.5">Click or drag file here</span>
                  </>
                )}
              </motion.div>
            </div>

            {/* Back of ID Dropzone (Only shown if document requires back page) */}
            {!selectedDocConfig.hideBackDoc && (
              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-[#6B6B67] block">
                  {selectedDocConfig.backLabel || "Upload Back of ID"}
                </span>
                <motion.div
                  whileHover={{ scale: 1.015 }}
                  animate={{
                    scale: isDraggingBack ? 1.03 : 1,
                    borderColor: isDraggingBack ? "#0B5D45" : undefined,
                  }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleTriggerUpload("idBackUrl")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingBack(true);
                  }}
                  onDragLeave={() => setIsDraggingBack(false)}
                  onDrop={(e) => handleDrop(e, "idBackUrl")}
                  className={`h-44 rounded-2xl border transition-all cursor-pointer relative flex flex-col items-center justify-center p-4 text-center overflow-hidden ${
                    isDraggingBack
                      ? "border-[#0B5D45] bg-[#0B5D45]/[0.06] ring-2 ring-[#0B5D45]/20"
                      : data.idBackUrl
                      ? "border-[#0B5D45] bg-[#F4F7F5]"
                      : "border-[#E7E5E0] bg-[#0B5D45]/[0.02] hover:bg-[#0B5D45]/[0.045] hover:border-[#0B5D45]"
                  }`}
                >
                  {uploadingField === "idBackUrl" ? (
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                      <span className="text-xs text-[#0B5D45] font-medium">Processing &amp; uploading...</span>
                    </div>
                  ) : data.idBackUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-between">
                      <div className="relative w-full h-24 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                        {isDocOrPdf(data.idBackUrl) ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B5D45]">
                            <FileText size={20} />
                            <span>Document Attached</span>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={data.idBackUrl}
                            alt="Back of ID"
                            className="w-full h-full object-cover rounded-xl"
                          />
                        )}
                      </div>

                      <div className="w-full flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={(e) => handleOpenPreview("Back of ID", data.idBackUrl, e)}
                          className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveField("idBackUrl", e)}
                          className="text-xs text-[#8B8B86] hover:text-[#171717] underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#E7E5E0] text-[#0B5D45] flex items-center justify-center shadow-xs mb-2">
                        <FileUp size={20} />
                      </div>
                      <span className="text-xs font-semibold text-[#171717]">
                        {selectedDocConfig.backLabel}
                      </span>
                      <span className="text-[11px] text-[#8B8B86] mt-0.5">Click or drag file here</span>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Restructured Biometric Liveness Verification State */}
        <div className="pt-2">
          {data.selfieUrl ? (
            /* Flattened "Verified" Profile Card without nested bounding boxes */
            <div className="rounded-2xl bg-[#EDF5F2] border border-[#0B5D45]/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.selfieUrl}
                    alt="Verified Selfie"
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-[#0B5D45] ring-offset-2"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0B5D45] text-white flex items-center justify-center shadow-xs">
                    <Check size={11} strokeWidth={3} />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14.5px] font-semibold text-[#171717] leading-tight">
                      Liveness Proof Confirmed
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#0B5D45] text-white text-[10px] font-bold">
                      Verified
                    </span>
                  </div>
                  <p className="text-[12px] text-[#6B6B67] mt-1">
                    Captured via encrypted real-time biometric sensor
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleOpenPreview("Headshot Selfie", data.selfieUrl, e)}
                  className="px-3 py-1.5 rounded-lg border border-[#0B5D45]/20 bg-white hover:bg-[#FAFAF8] text-xs font-semibold text-[#0B5D45] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Eye size={13} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLivenessModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#0B5D45]/20 bg-white hover:bg-[#FAFAF8] text-xs font-semibold text-[#171717] hover:text-[#0B5D45] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <RotateCw size={13} />
                  <span>Re-scan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveField("selfieUrl")}
                  className="text-xs font-medium text-[#6B6B67] hover:text-[#171717] underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            /* Unverified Initial CTA State */
            <div className="p-5 sm:p-6 rounded-2xl border border-[#E7E5E0] bg-[#FAFAF8] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B5D45]/10 text-[#0B5D45] flex items-center justify-center shrink-0">
                  <ScanFace size={22} />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-[#171717]">
                    Biometric Liveness Verification
                  </h3>
                  <p className="text-[12px] text-[#6B6B67]">
                    Real-time facial liveness check to verify identity and activate host rights
                  </p>
                </div>
              </div>

              {uploadingField === "selfieUrl" ? (
                <div className="h-28 rounded-xl border border-[#E7E5E0] bg-white flex flex-col items-center justify-center p-4 text-center">
                  <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                  <span className="text-xs text-[#0B5D45] font-medium">Encrypting &amp; securing selfie...</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsLivenessModalOpen(true)}
                    className="flex-1 h-[48px] px-5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <ScanFace size={16} />
                    <span>Start Liveness Scan (Biometric)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerUpload("selfieUrl")}
                    className="h-[48px] px-5 rounded-xl border border-[#E7E5E0] bg-white hover:bg-[#FAFAF8] text-[13px] font-medium text-[#6B6B67] hover:text-[#171717] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Camera size={15} />
                    <span>Upload Photo Instead</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Sticky Footer Action Bar: Consolidated & Visually Balanced */}
        <div className="sticky -bottom-6 sm:-bottom-10 bg-white/95 backdrop-blur-md border-t border-[#E7E5E0] py-4 px-6 sm:px-10 mt-10 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 rounded-b-2xl sm:rounded-b-3xl flex flex-col sm:flex-row items-center justify-between gap-4 z-20">
          {/* Secondary Actions (Grouped on Left without borders) */}
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
            <Link
              href="/host/onboarding/profile"
              className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Profile</span>
            </Link>

            <Link
              href="/host/dashboard"
              className="text-[13.5px] font-medium text-[#8B8B86] hover:text-[#171717] transition-colors"
            >
              Skip to Dashboard
            </Link>
          </div>

          {/* Primary Action (Strictly on Right with Soft Glowing Brand Shadow) */}
          <button
            type="submit"
            disabled={isNavigating}
            className="group w-full sm:w-auto h-[50px] px-7 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_16px_rgba(11,93,69,0.28)] hover:shadow-[0_6px_22px_rgba(11,93,69,0.38)] disabled:opacity-50"
          >
            <span>Continue to Authority &amp; Payout</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </form>
    </div>
  );
}
