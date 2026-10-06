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
  Camera,
  FileText,
  Loader2,
  Eye,
  Trash2,
  RotateCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { compressFile } from "@/lib/imageCompression";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";

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

  // Modal preview state
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; title: string; url: string }>({
    isOpen: false,
    title: "",
    url: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetField, setTargetField] = useState<"idFrontUrl" | "idBackUrl" | "selfieUrl">("idFrontUrl");

  const handleTriggerUpload = (field: "idFrontUrl" | "idBackUrl" | "selfieUrl") => {
    setTargetField(field);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(targetField);
    setError(null);

    try {
      // 1. Compress image to max 1280px / 0.75 JPEG to prevent 413 Payload Too Large
      const compressedDataUrl = await compressFile(file);

      // 2. Upload to storage API (with graceful fallback to compressed data URL)
      try {
        const res = await api.uploadImage(compressedDataUrl, "kyc");
        const url = res.url || compressedDataUrl;
        updateData({ [targetField]: url });
      } catch (err: any) {
        // Fall back to compressed data URL if remote storage has temporary issue
        updateData({ [targetField]: compressedDataUrl });
      }
    } catch (err: any) {
      setError("Failed to read image file. Please choose another image.");
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

    // Background save to backend
    saveStepData(3).catch(() => null);
    router.push("/host/onboarding/authority");
  };

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
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
          Stage 3 of 4 • Identity Verification
        </span>
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mt-3 mb-2">
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
                  {/* Thumbnail */}
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.idFrontUrl}
                      alt="Front of ID"
                      className="w-full h-full object-cover rounded-lg"
                    />
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
                  <span className="text-xs font-semibold text-[#171717]">Upload ID Front</span>
                  <span className="text-[11px] text-[#8B8B86] mt-0.5">JPG, PNG or PDF</span>
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
                  {/* Thumbnail */}
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.idBackUrl}
                      alt="Back of ID"
                      className="w-full h-full object-cover rounded-lg"
                    />
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
                  <span className="text-xs font-semibold text-[#171717]">Upload ID Back</span>
                  <span className="text-[11px] text-[#8B8B86] mt-0.5">If applicable</span>
                </>
              )}
            </div>
          </div>

          {/* 3. Live Headshot Selfie */}
          <div className="space-y-1.5">
            <span className="text-[12.5px] font-semibold text-[#171717] block">Headshot Selfie *</span>
            <div
              onClick={() => handleTriggerUpload("selfieUrl")}
              className={`h-44 rounded-2xl border-2 border-dashed relative flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer overflow-hidden ${
                data.selfieUrl
                  ? "border-[#0B5D45] bg-[#F4F7F5]"
                  : "border-[#E7E5E0] hover:border-[#0B5D45] hover:bg-[#FAFAF8]"
              }`}
            >
              {uploadingField === "selfieUrl" ? (
                <div className="flex flex-col items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-[#0B5D45] mb-2" />
                  <span className="text-xs text-[#0B5D45] font-medium">Compressing &amp; uploading...</span>
                </div>
              ) : data.selfieUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-between p-1">
                  {/* Thumbnail */}
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.selfieUrl}
                      alt="Selfie"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>

                  {/* Actions Bar */}
                  <div className="w-full flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={(e) => handleOpenPreview("Headshot Selfie", data.selfieUrl, e)}
                      className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveField("selfieUrl", e)}
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
                  <Camera size={24} className="text-[#8B8B86] mb-2" />
                  <span className="text-xs font-semibold text-[#171717]">Upload Selfie</span>
                  <span className="text-[11px] text-[#8B8B86] mt-0.5">Clear face photo</span>
                </>
              )}
            </div>
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
