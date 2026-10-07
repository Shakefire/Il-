"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  CheckCircle2,
  Camera,
  FileText,
  Loader2,
  Eye,
  Trash2,
  RotateCw,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { compressFile } from "@/lib/imageCompression";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";
import FintechLivenessModal, { preloadLivenessEngine } from "@/components/FintechLivenessModal";

const ID_TYPES = [
  { id: "nin", label: "National Identification Number (NIN)", desc: "NIN Slip or Digital NIN Card" },
  { id: "drivers_license", label: "Driver's Licence (FRSC)", desc: "Valid Nigerian Driver's Licence" },
  { id: "passport", label: "International Passport", desc: "Data page of valid Nigerian Passport" },
  { id: "voters_card", label: "Voter's Card (INEC PVC)", desc: "Permanent Voter's Card" },
];

export default function IdentityStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB maximum limit. Please upload a file up to 15MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingField(targetField);
    setError(null);

    try {
      // 1. Process & compress file (validates 15MB limit)
      const compressedDataUrl = await compressFile(file);

      // 2. Upload to storage API (with graceful fallback to processed data URL)
      try {
        const res = await api.uploadImage(compressedDataUrl, "kyc");
        const url = res.url || compressedDataUrl;
        updateData({ [targetField]: url });
      } catch (err: any) {
        // Fall back to processed data URL if remote storage has temporary issue
        updateData({ [targetField]: compressedDataUrl });
      }
    } catch (err: any) {
      setError(err.message || "Failed to process file. Please choose another file.");
    } finally {
      setUploadingField(null);
      // Reset input value so re-uploading same file triggers change
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveField = (field: "idFrontUrl" | "idBackUrl" | "selfieUrl", e: React.MouseEvent) => {
    e.stopPropagation();
    updateData({ [field]: "" });
  };

  const handleOpenPreview = (title: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewModal({ isOpen: true, title, url });
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.idNumber.trim()) {
      setError("Please provide your ID document number.");
      return;
    }

    if (!data.idFrontUrl) {
      setError("Please upload the front of your government-issued ID.");
      return;
    }

    if (!data.selfieUrl) {
      setError("Please upload a clear headshot selfie for facial verification.");
      return;
    }

    // Ensure data is saved to backend before navigating
    await saveStepData(3);
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

      {/* Fintech Biometric Liveness Modal */}
      <FintechLivenessModal
        isOpen={isLivenessModalOpen}
        onClose={() => setIsLivenessModalOpen(false)}
        onComplete={(result) => {
          updateData({ selfieUrl: result.snapshotUrl });
        }}
      />

      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mb-2">
          Verify your identity
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Upload your government-issued ID and a clear headshot photo. You can preview your uploads to ensure text is sharp and legible.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleContinue} className="space-y-6">
        {/* ID Document Selection */}
        <div className="space-y-3">
          <label className="text-[13px] font-semibold text-[#171717] block">Select Identity Document</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ID_TYPES.map((idOpt) => {
              const isSelected = data.idType === idOpt.id;

              return (
                <div
                  key={idOpt.id}
                  onClick={() => updateData({ idType: idOpt.id })}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? "border-[#0B5D45] bg-[#F4F7F5] shadow-xs ring-1 ring-[#0B5D45]"
                      : "border-[#E7E5E0] bg-white hover:border-[#D1CEC7]"
                  }`}
                >
                  <FileText
                    size={18}
                    className={`shrink-0 mt-0.5 ${isSelected ? "text-[#0B5D45]" : "text-[#8B8B86]"}`}
                  />
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-[#171717]">{idOpt.label}</h4>
                    <p className="text-[12px] text-[#6B6B67] mt-0.5">{idOpt.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ID Number */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-[#171717]">ID Document Number</label>
            <span className="text-[12px] text-[#8B8B86]">Exact number on card/slip</span>
          </div>
          <input
            type="text"
            value={data.idNumber}
            onChange={(e) => updateData({ idNumber: e.target.value })}
            placeholder="e.g. 11-digit NIN or Driver's Licence Number"
            required
            className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all font-mono"
          />
        </div>

        {/* Document Uploads with Visual Previews */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* 1. Front of ID */}
          <div className="space-y-1.5">
            <span className="text-[12.5px] font-semibold text-[#171717] block">Front of ID *</span>
            <div
              onClick={() => handleTriggerUpload("idFrontUrl")}
              className={`h-44 rounded-2xl border-2 border-dashed relative flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer overflow-hidden ${
                data.idFrontUrl
                  ? "border-[#0B5D45] bg-[#F4F7F5]"
                  : "border-[#E7E5E0] hover:border-[#0B5D45] hover:bg-[#FAFAF8]"
              }`}
            >
              {uploadingField === "idFrontUrl" ? (
                <div className="flex flex-col items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                  <span className="text-xs text-[#0B5D45] font-medium">Compressing &amp; uploading...</span>
                </div>
              ) : data.idFrontUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-between p-1">
                  {/* Thumbnail / Document Indicator */}
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
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
                        className="w-full h-full object-cover rounded-lg"
                      />
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="w-full flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={(e) => handleOpenPreview("Front of ID", data.idFrontUrl, e)}
                      className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveField("idFrontUrl", e)}
                      className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={24} className="text-[#8B8B86] mb-2" />
                  <span className="text-xs font-semibold text-[#171717]">Upload ID Front (Max 15MB)</span>
                  <span className="text-[11px] text-[#8B8B86] mt-0.5">JPG, PNG, PDF, or Word DOC</span>
                </>
              )}
            </div>
          </div>

          {/* 2. Back of ID */}
          <div className="space-y-1.5">
            <span className="text-[12.5px] font-semibold text-[#171717] block">Back of ID (Optional)</span>
            <div
              onClick={() => handleTriggerUpload("idBackUrl")}
              className={`h-44 rounded-2xl border-2 border-dashed relative flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer overflow-hidden ${
                data.idBackUrl
                  ? "border-[#0B5D45] bg-[#F4F7F5]"
                  : "border-[#E7E5E0] hover:border-[#0B5D45] hover:bg-[#FAFAF8]"
              }`}
            >
              {uploadingField === "idBackUrl" ? (
                <div className="flex flex-col items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                  <span className="text-xs text-[#0B5D45] font-medium">Compressing &amp; uploading...</span>
                </div>
              ) : data.idBackUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-between p-1">
                  {/* Thumbnail / Document Indicator */}
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
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
                        className="w-full h-full object-cover rounded-lg"
                      />
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="w-full flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={(e) => handleOpenPreview("Back of ID", data.idBackUrl, e)}
                      className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveField("idBackUrl", e)}
                      className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={24} className="text-[#8B8B86] mb-2" />
                  <span className="text-xs font-semibold text-[#171717]">Upload ID Back (Max 15MB)</span>
                  <span className="text-[11px] text-[#8B8B86] mt-0.5">If applicable (up to 15MB)</span>
                </>
              )}
            </div>
          </div>

          {/* 3. Live Headshot Selfie */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-[#171717] block">
                Headshot Selfie *
              </span>
              <span className="text-[11px] font-medium text-[#0B5D45] flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>Biometric Check</span>
              </span>
            </div>

            {uploadingField === "selfieUrl" ? (
              <div className="h-48 rounded-2xl border-2 border-dashed border-[#0B5D45] bg-[#F4F7F5] flex flex-col items-center justify-center p-3 text-center">
                <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                <span className="text-xs text-[#0B5D45] font-medium">Compressing &amp; uploading...</span>
              </div>
            ) : data.selfieUrl ? (
              <div className="h-48 rounded-2xl border border-[#0B5D45] bg-[#F4F7F5] p-3 flex flex-col items-center justify-between">
                {/* Thumbnail with Verified Badge */}
                <div className="relative w-full h-32 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.selfieUrl}
                    alt="Selfie"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#0B5D45] text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    <CheckCircle2 size={11} />
                    <span>Verified</span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="w-full flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleOpenPreview("Headshot Selfie", data.selfieUrl, e)}
                      className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLivenessModalOpen(true)}
                      className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ScanFace size={13} />
                      <span>Re-scan</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveField("selfieUrl", e)}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[#E7E5E0] hover:border-[#0B5D45] bg-white hover:bg-[#FAFAF8] p-4 text-center transition-all flex flex-col items-center justify-center min-h-[192px]">
                <div className="w-10 h-10 rounded-full bg-[#EDF5F2] text-[#0B5D45] flex items-center justify-center mb-2">
                  <ScanFace size={22} />
                </div>

                <h4 className="text-[13px] font-semibold text-[#171717]">Facial Biometric Check</h4>
                <p className="text-[11px] text-[#6B6B67] mt-0.5 max-w-[240px]">
                  OPay-style real-time liveness check with camera
                </p>

                <div className="mt-3.5 w-full flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLivenessModalOpen(true)}
                    className="w-full h-9 px-3 rounded-lg bg-[#0B5D45] hover:bg-[#084936] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <ScanFace size={14} />
                    <span>Scan Face (Biometric)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerUpload("selfieUrl")}
                    className="text-[11.5px] font-medium text-[#6B6B67] hover:text-[#171717] hover:underline flex items-center justify-center gap-1 py-0.5 cursor-pointer"
                  >
                    <Camera size={12} />
                    <span>Or upload photo (Max 15MB)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-4 border-t border-[#E7E5E0] flex items-center justify-between gap-4">
          <Link
            href="/host/onboarding/profile"
            className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Profile</span>
          </Link>

          <button
            type="submit"
            className="h-[50px] px-7 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <span>Continue to Authority &amp; Payout</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
