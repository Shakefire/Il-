"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import { ArrowRight, ArrowLeft, Upload, CheckCircle2, Camera, FileText, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";

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
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const res = await api.uploadImage(base64, "kyc");
          const url = res.url || base64;
          updateData({ [targetField]: url });
        } catch {
          // If upload API fails, fall back to base64 so draft is preserved
          updateData({ [targetField]: base64 });
        } finally {
          setUploadingField(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError("Failed to read image file. Please choose another image.");
      setUploadingField(null);
    }
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

      <div className="mb-8">
        <span className="text-[11px] font-bold text-[#0B5D45] uppercase tracking-widest bg-[#EDF5F2] px-3 py-1 rounded-full border border-[#0B5D45]/15">
          Stage 3 of 6 • Identity Verification
        </span>
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mt-3 mb-2">
          Verify your identity
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          To maintain guest confidence and marketplace trust, all property partners verify their identity with a Nigerian government ID and face photo.
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

        {/* Document Uploads: Front, Back, and Selfie */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Front of ID */}
          <div className="space-y-1.5">
            <span className="text-[12.5px] font-semibold text-[#171717] block">Front of ID *</span>
            <div
              onClick={() => handleTriggerUpload("idFrontUrl")}
              className={`h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer ${
                data.idFrontUrl
                  ? "border-[#0B5D45] bg-[#F4F7F5]"
                  : "border-[#E7E5E0] hover:border-[#0B5D45] hover:bg-[#FAFAF8]"
              }`}
            >
              {uploadingField === "idFrontUrl" ? (
                <Loader2 size={24} className="animate-spin text-[#0B5D45]" />
              ) : data.idFrontUrl ? (
                <>
                  <CheckCircle2 size={26} className="text-[#0B5D45] mb-1.5" />
                  <span className="text-xs font-semibold text-[#0B5D45]">ID Front Attached</span>
                  <span className="text-[10.5px] text-[#6B6B67] mt-0.5">Click to replace</span>
                </>
              ) : (
                <>
                  <Upload size={22} className="text-[#8B8B86] mb-1.5" />
                  <span className="text-xs font-medium text-[#171717]">Upload Front</span>
                  <span className="text-[10.5px] text-[#8B8B86]">JPG, PNG or PDF</span>
                </>
              )}
            </div>
          </div>

          {/* Back of ID */}
          <div className="space-y-1.5">
            <span className="text-[12.5px] font-semibold text-[#171717] block">Back of ID (Optional)</span>
            <div
              onClick={() => handleTriggerUpload("idBackUrl")}
              className={`h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer ${
                data.idBackUrl
                  ? "border-[#0B5D45] bg-[#F4F7F5]"
                  : "border-[#E7E5E0] hover:border-[#0B5D45] hover:bg-[#FAFAF8]"
              }`}
            >
              {uploadingField === "idBackUrl" ? (
                <Loader2 size={24} className="animate-spin text-[#0B5D45]" />
              ) : data.idBackUrl ? (
                <>
                  <CheckCircle2 size={26} className="text-[#0B5D45] mb-1.5" />
                  <span className="text-xs font-semibold text-[#0B5D45]">ID Back Attached</span>
                  <span className="text-[10.5px] text-[#6B6B67] mt-0.5">Click to replace</span>
                </>
              ) : (
                <>
                  <Upload size={22} className="text-[#8B8B86] mb-1.5" />
                  <span className="text-xs font-medium text-[#171717]">Upload Back</span>
                  <span className="text-[10.5px] text-[#8B8B86]">If applicable</span>
                </>
              )}
            </div>
          </div>

          {/* Live Headshot Selfie */}
          <div className="space-y-1.5">
            <span className="text-[12.5px] font-semibold text-[#171717] block">Headshot Selfie *</span>
            <div
              onClick={() => handleTriggerUpload("selfieUrl")}
              className={`h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer ${
                data.selfieUrl
                  ? "border-[#0B5D45] bg-[#F4F7F5]"
                  : "border-[#E7E5E0] hover:border-[#0B5D45] hover:bg-[#FAFAF8]"
              }`}
            >
              {uploadingField === "selfieUrl" ? (
                <Loader2 size={24} className="animate-spin text-[#0B5D45]" />
              ) : data.selfieUrl ? (
                <>
                  <CheckCircle2 size={26} className="text-[#0B5D45] mb-1.5" />
                  <span className="text-xs font-semibold text-[#0B5D45]">Selfie Attached</span>
                  <span className="text-[10.5px] text-[#6B6B67] mt-0.5">Click to replace</span>
                </>
              ) : (
                <>
                  <Camera size={22} className="text-[#8B8B86] mb-1.5" />
                  <span className="text-xs font-medium text-[#171717]">Upload Selfie</span>
                  <span className="text-[10.5px] text-[#8B8B86]">Clear face photo</span>
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
