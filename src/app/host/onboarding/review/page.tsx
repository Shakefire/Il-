"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Eye,
  Check,
  ChevronDown,
  Edit2,
  Clock,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DocumentPreviewModal from "@/components/onboarding/DocumentPreviewModal";
import StepMotion from "@/components/onboarding/StepMotion";

const ID_TYPE_LABELS: Record<string, string> = {
  nin: "National Identification Number (NIN)",
  drivers_license: "Driver's Licence (FRSC)",
  passport: "International Passport",
  voters_card: "Voter's Card (INEC PVC)",
};

const ONBOARDING_STEPS = [
  { step: 1, label: "Host Type", href: "/host/onboarding/business-type" },
  { step: 2, label: "Profile", href: "/host/onboarding/profile" },
  { step: 3, label: "Identity", href: "/host/onboarding/identity" },
  { step: 4, label: "Authority & Payout", href: "/host/onboarding/authority" },
  { step: 5, label: "Review Application", href: "/host/onboarding/review" },
];

export default function ReviewStepPage() {
  const router = useRouter();
  const { data, submitApplication, isSubmitting } = useOnboarding();

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsTouched, setTermsTouched] = useState(false);

  // Accordion open/close states (Identity & Authority open by default for immediate visual document inspection)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    business: false,
    profile: false,
    identity: true,
    authority: true,
  });

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

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleOpenPreview = (title: string, url: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!url) return;
    setPreviewModal({ isOpen: true, title, url });
  };

  const maskNumber = (numStr?: string, showCount: number = 4) => {
    if (!numStr) return "Not provided";
    const cleaned = numStr.trim();
    if (cleaned.length <= showCount) return cleaned;
    const maskedLength = cleaned.length - showCount;
    return "•••••••" + cleaned.slice(-showCount);
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

  // Section completion status helpers
  const isBusinessComplete = Boolean(data.hostType && data.phone && (data.hostType !== "company" || data.companyName));
  const isProfileComplete = Boolean(
    data.firstName?.trim() &&
    data.lastName?.trim() &&
    data.residentialAddress?.trim() &&
    data.operatingCity
  );
  const isIdentityComplete = Boolean(data.idNumber?.trim() && data.idFrontUrl && data.selfieUrl);
  const isAuthorityComplete = Boolean(
    data.authorityDocUrl &&
    data.bankName &&
    data.bankAccountNumber?.replace(/\D/g, "").length === 10 &&
    data.bankAccountName?.trim().length >= 3
  );

  const getHostTypeDisplay = () => {
    if (data.hostType === "company") {
      return `Registered Business${data.companyName ? ` (${data.companyName})` : ""}`;
    }
    if (data.hostType === "property_manager") {
      return "Co-Host or Property Manager";
    }
    return "Individual Property Owner";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTermsTouched(true);
    setError(null);

    if (!agreedToTerms) {
      setError("Please accept the declaration before submitting your application.");
      return;
    }

    // Safety checks for required documents
    if (!data.idFrontUrl) {
      setError("Front ID document is missing. Please edit Section 3 (Identity verification) to attach your valid government ID.");
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }

    if (!data.selfieUrl) {
      setError("Face verification is missing. Please edit Section 3 to complete your face check.");
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }

    if (!data.authorityDocUrl) {
      setError("Property utility bill is missing. Please edit Section 4 (Property & payout) to attach your utility bill.");
      setOpenSections((prev) => ({ ...prev, authority: true }));
      return;
    }

    if (!data.bankAccountNumber || data.bankAccountNumber.replace(/\D/g, "").length !== 10) {
      setError("A valid 10-digit Nigerian account number is required in Section 4.");
      setOpenSections((prev) => ({ ...prev, authority: true }));
      return;
    }

    try {
      await submitApplication();
      router.push("/host/onboarding/status");
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to submit application. Please check your connection and try again."
      );
    }
  };

  return (
    <StepMotion className="w-full max-w-3xl mx-auto pb-12">
      {/* Document Preview Lightbox Modal */}
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
            Step 5 of 5 • Review Application
          </span>
          <span className="text-[12px] text-[#6B7280]">
            100% completed
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding Progress">
          {ONBOARDING_STEPS.map((s) => (
            <div
              key={s.step}
              className="h-1.5 rounded-full bg-[#065F46] transition-all duration-300"
            />
          ))}
        </div>
      </div>

      {/* Header and Introduction */}
      <div className="mb-8 sm:mb-10">
        <h1 className="font-serif text-[30px] sm:text-[36px] font-normal tracking-tight text-[#111827] leading-[1.15]">
          Review your details
        </h1>
        <p className="mt-2 text-[15px] sm:text-[16px] text-[#4B5563] leading-relaxed max-w-2xl">
          Check that your information and uploaded documents are correct before submitting your host application.
        </p>

        {/* 24-48 Hour Review Turnaround Note */}
        <div className="mt-4 p-3.5 rounded-xl bg-[#FAFAF8] border border-[#E5E7EB] flex items-center gap-2.5 text-xs text-[#4B5563]">
          <Clock size={16} className="text-[#065F46] shrink-0" />
          <span>
            Our team reviews host applications within <strong>24–48 hours</strong>. You can edit any section before submitting.
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150" role="alert">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        {/* ────────────────────────────────────────────────────────── */}
        {/* Accordion Review Interface                                 */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="space-y-3.5">
          
          {/* ────────────────────────────────────────────────────────── */}
          {/* Section 1: Business Structure                              */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] bg-white overflow-hidden transition-colors">
            {/* Accordion Row Header */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={Boolean(openSections.business)}
              aria-controls="section-content-business"
              onClick={() => toggleSection("business")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSection("business");
                }
              }}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors select-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#065F46]">
                    1. Host Type &amp; Phone
                  </span>
                </div>
                <div className="text-sm font-medium text-[#111827] truncate">
                  {getHostTypeDisplay()} · {data.phone || "No phone added"}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {isBusinessComplete ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#065F46] bg-[#EDF5F2] border border-[#065F46]/20 px-2 py-0.5 rounded-full">
                    <Check size={11} strokeWidth={2.5} />
                    <span>Complete</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Review
                  </span>
                )}

                <Link
                  href="/host/onboarding/business-type"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-[#4B5563] hover:text-[#111827] px-2 py-1 rounded hover:bg-stone-100 active:scale-[0.99] flex items-center gap-1 transition-all"
                  title="Edit Business Structure"
                >
                  <Edit2 size={12} />
                  <span className="hidden sm:inline">Edit</span>
                </Link>

                <div className={`text-[#6B7280] transition-transform duration-200 ${openSections.business ? "rotate-180" : ""}`}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Accordion Expanded Content */}
            <AnimatePresence initial={false}>
              {openSections.business && (
                <motion.div
                  key="content-business"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div id="section-content-business" className="px-4 pb-5 sm:px-5 sm:pb-6 pt-1 border-t border-[#E5E7EB]/70 bg-[#FAFAF8]/50 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Host Classification
                        </span>
                        <span className="text-sm text-[#111827] font-medium">
                          {getHostTypeDisplay()}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Operations Phone
                        </span>
                        <span className="text-sm font-mono text-[#111827] font-medium">
                          {data.phone || "Not specified"}
                        </span>
                      </div>

                      {data.hostType === "company" && (
                        <>
                          <div>
                            <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                              Registered Business Name
                            </span>
                            <span className="text-sm text-[#111827] font-medium">
                              {data.companyName || "Not provided"}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                              CAC Registration Number
                            </span>
                            <span className="text-sm font-mono text-[#111827] font-medium">
                              {data.companyRegNumber || "Not provided"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/host/onboarding/business-type"
                        className="text-xs font-semibold text-[#065F46] hover:underline flex items-center gap-1"
                      >
                        <span>Edit business details</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Section 2: Profile & Operating Location                    */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] bg-white overflow-hidden transition-colors">
            {/* Accordion Row Header */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={Boolean(openSections.profile)}
              aria-controls="section-content-profile"
              onClick={() => toggleSection("profile")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSection("profile");
                }
              }}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors select-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#065F46]">
                    2. Personal Details &amp; Operating Areas
                  </span>
                </div>
                <div className="text-sm font-medium text-[#111827] truncate">
                  {data.firstName || data.lastName ? `${data.firstName} ${data.lastName}` : "Profile Pending"} · {data.operatingCity || "Abuja"}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {isProfileComplete ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#065F46] bg-[#EDF5F2] border border-[#065F46]/20 px-2 py-0.5 rounded-full">
                    <Check size={11} strokeWidth={2.5} />
                    <span>Complete</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Review
                  </span>
                )}

                <Link
                  href="/host/onboarding/profile"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-[#4B5563] hover:text-[#111827] px-2 py-1 rounded hover:bg-stone-100 active:scale-[0.99] flex items-center gap-1 transition-all"
                  title="Edit Profile"
                >
                  <Edit2 size={12} />
                  <span className="hidden sm:inline">Edit</span>
                </Link>

                <div className={`text-[#6B7280] transition-transform duration-200 ${openSections.profile ? "rotate-180" : ""}`}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Accordion Expanded Content */}
            <AnimatePresence initial={false}>
              {openSections.profile && (
                <motion.div
                  key="content-profile"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div id="section-content-profile" className="px-4 pb-5 sm:px-5 sm:pb-6 pt-1 border-t border-[#E5E7EB]/70 bg-[#FAFAF8]/50 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Legal Host Name
                        </span>
                        <span className="text-sm text-[#111827] font-medium">
                          {data.firstName} {data.lastName}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Date of Birth
                        </span>
                        <span className="text-sm font-mono text-[#111827] font-medium">
                          {data.dateOfBirth || "Not provided"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Primary Operating City
                        </span>
                        <span className="text-sm text-[#111827] font-medium">
                          {data.operatingCity || "Abuja"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Operating Neighbourhoods
                        </span>
                        <span className="text-sm text-[#111827] font-medium">
                          {data.operatingAreas || "All serviced areas"}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Residential Street Address
                        </span>
                        <span className="text-sm text-[#111827] font-medium break-words leading-relaxed">
                          {data.residentialAddress || "Not provided"}
                        </span>
                      </div>

                      {data.bio && (
                        <div className="sm:col-span-2 pt-2 border-t border-[#E5E7EB]/60">
                          <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                            Hosting Practice Biography
                          </span>
                          <p className="text-xs text-[#4B5563] leading-relaxed italic bg-white p-3 rounded-lg border border-[#E5E7EB]">
                            &ldquo;{data.bio}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/host/onboarding/profile"
                        className="text-xs font-semibold text-[#065F46] hover:underline flex items-center gap-1"
                      >
                        <span>Edit profile details</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Section 3: Identity Verification with Inline Document Previews */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] bg-white overflow-hidden transition-colors">
            {/* Accordion Row Header */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={Boolean(openSections.identity)}
              aria-controls="section-content-identity"
              onClick={() => toggleSection("identity")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSection("identity");
                }
              }}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors select-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#065F46]">
                    3. Identity Verification
                  </span>
                </div>
                <div className="text-sm font-medium text-[#111827] truncate">
                  {ID_TYPE_LABELS[data.idType] ? ID_TYPE_LABELS[data.idType].split("(")[0].trim() : "Government ID"} · {maskNumber(data.idNumber, 4)} · {data.selfieUrl ? "Face Verified" : "Selfie Pending"}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {isIdentityComplete ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#065F46] bg-[#EDF5F2] border border-[#065F46]/20 px-2 py-0.5 rounded-full">
                    <Check size={11} strokeWidth={2.5} />
                    <span>Complete</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Review
                  </span>
                )}

                <Link
                  href="/host/onboarding/identity"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-[#4B5563] hover:text-[#111827] px-2 py-1 rounded hover:bg-stone-100 active:scale-[0.99] flex items-center gap-1 transition-all"
                  title="Edit Identity Verification"
                >
                  <Edit2 size={12} />
                  <span className="hidden sm:inline">Edit</span>
                </Link>

                <div className={`text-[#6B7280] transition-transform duration-200 ${openSections.identity ? "rotate-180" : ""}`}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Accordion Expanded Content */}
            <AnimatePresence initial={false}>
              {openSections.identity && (
                <motion.div
                  key="content-identity"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div id="section-content-identity" className="px-4 pb-5 sm:px-5 sm:pb-6 pt-1 border-t border-[#E5E7EB]/70 bg-[#FAFAF8]/50 space-y-5">
                    {/* Identity Text Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Document Type
                        </span>
                        <span className="text-sm text-[#111827] font-medium">
                          {ID_TYPE_LABELS[data.idType] || data.idType || "NIN"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Document Number
                        </span>
                        <span className="text-sm font-mono text-[#111827] font-medium">
                          {maskNumber(data.idNumber, 4)}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-1">
                          Face Verification
                        </span>
                        <span className="text-sm font-medium">
                          {data.selfieUrl ? (
                            <span className="text-[#065F46] flex items-center gap-1">
                              <Check size={14} strokeWidth={2.5} /> Verified
                            </span>
                          ) : (
                            <span className="text-rose-600">Pending Verification</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Inline Document Thumbnails */}
                    <div>
                      <span className="block text-[#6B7280] uppercase tracking-wider text-[10.5px] font-semibold mb-2">
                        Attached Identity Documents
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Front ID Thumbnail */}
                        <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#111827]">Front of ID</span>
                            {data.idFrontUrl ? (
                              <span className="text-[10.5px] text-[#065F46] font-semibold flex items-center gap-0.5">
                                <Check size={11} strokeWidth={2.5} /> Attached
                              </span>
                            ) : (
                              <span className="text-[10.5px] text-rose-600 font-semibold">Missing</span>
                            )}
                          </div>

                          <div className="w-full h-32 rounded-lg overflow-hidden bg-stone-100 border border-[#E5E7EB] flex items-center justify-center relative">
                            {data.idFrontUrl ? (
                              isDocOrPdf(data.idFrontUrl) ? (
                                <div className="flex flex-col items-center justify-center p-3 text-center">
                                  <FileText size={28} className="text-[#065F46] mb-1" />
                                  <span className="text-xs font-semibold text-[#111827]">Document Attached</span>
                                  <span className="text-[10px] text-[#6B7280]">PDF Format</span>
                                </div>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={data.idFrontUrl}
                                  alt="Front of ID"
                                  className="w-full h-full object-contain"
                                />
                              )
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">No document uploaded</span>
                            )}
                          </div>

                          {data.idFrontUrl && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenPreview("Front of ID", data.idFrontUrl, e)}
                              className="w-full h-8 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#065F46] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>View Document</span>
                            </button>
                          )}
                        </div>

                        {/* Back ID Thumbnail */}
                        <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#111827]">Back of ID</span>
                            {data.idBackUrl ? (
                              <span className="text-[10.5px] text-[#065F46] font-semibold flex items-center gap-0.5">
                                <Check size={11} strokeWidth={2.5} /> Attached
                              </span>
                            ) : (
                              <span className="text-[10.5px] text-[#6B7280]">Optional</span>
                            )}
                          </div>

                          <div className="w-full h-32 rounded-lg overflow-hidden bg-stone-100 border border-[#E5E7EB] flex items-center justify-center relative">
                            {data.idBackUrl ? (
                              isDocOrPdf(data.idBackUrl) ? (
                                <div className="flex flex-col items-center justify-center p-3 text-center">
                                  <FileText size={28} className="text-[#065F46] mb-1" />
                                  <span className="text-xs font-semibold text-[#111827]">Document Attached</span>
                                  <span className="text-[10px] text-[#6B7280]">PDF Format</span>
                                </div>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={data.idBackUrl}
                                  alt="Back of ID"
                                  className="w-full h-full object-contain"
                                />
                              )
                            ) : data.idType === "passport" ? (
                              <div className="text-center p-3 text-xs text-[#6B7280]">
                                <span>Back not required</span>
                                <span className="block text-[10px] text-[#9CA3AF] mt-0.5">Passport bio-data page sufficient</span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">Not provided (Optional)</span>
                            )}
                          </div>

                          {data.idBackUrl && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenPreview("Back of ID", data.idBackUrl, e)}
                              className="w-full h-8 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#065F46] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>View Document</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Biometric Liveness Proof Card */}
                    {data.selfieUrl ? (
                      <div className="p-3.5 rounded-xl border border-[#065F46]/25 bg-[#F4F7F5] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={data.selfieUrl}
                              alt="Biometric Headshot"
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-[#065F46] ring-offset-2"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#065F46] text-white flex items-center justify-center shadow-xs">
                              <Check size={9} strokeWidth={3} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[#111827]">
                                Face Verification
                              </span>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#065F46] text-white">
                                Verified
                              </span>
                            </div>
                            <p className="text-[11px] text-[#4B5563] mt-0.5">
                              Face scan verified and matches your details
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleOpenPreview("Biometric Verification Selfie", data.selfieUrl, e)}
                          className="h-8 px-2.5 rounded-md border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#065F46] flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        >
                          <Eye size={12} />
                          <span>View Selfie</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-rose-700 font-medium">
                          <AlertCircle size={15} />
                          <span>Biometric liveness selfie missing</span>
                        </div>
                        <Link
                          href="/host/onboarding/identity"
                          className="text-xs font-semibold text-[#065F46] hover:underline"
                        >
                          Complete check →
                        </Link>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/host/onboarding/identity"
                        className="text-xs font-semibold text-[#065F46] hover:underline flex items-center gap-1"
                      >
                        <span>Edit identity details</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Section 4: Authority & Bank Account with Inline Thumbnail  */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] bg-white overflow-hidden transition-colors">
            {/* Accordion Row Header */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={Boolean(openSections.authority)}
              aria-controls="section-content-authority"
              onClick={() => toggleSection("authority")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSection("authority");
                }
              }}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors select-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#065F46]">
                    4. Property &amp; Payout Account
                  </span>
                </div>
                <div className="text-sm font-medium text-[#111827] truncate">
                  Utility bill · {data.bankName ? data.bankName.split("(")[0].trim() : "Bank"} · Account ending {data.bankAccountNumber ? data.bankAccountNumber.slice(-4) : "••••"}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {isAuthorityComplete ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#065F46] bg-[#EDF5F2] border border-[#065F46]/20 px-2 py-0.5 rounded-full">
                    <Check size={11} strokeWidth={2.5} />
                    <span>Complete</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Review
                  </span>
                )}

                <Link
                  href="/host/onboarding/authority"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-[#4B5563] hover:text-[#111827] px-2 py-1 rounded hover:bg-stone-100 active:scale-[0.99] flex items-center gap-1 transition-all"
                  title="Edit Authority & Payouts"
                >
                  <Edit2 size={12} />
                  <span className="hidden sm:inline">Edit</span>
                </Link>

                <div className={`text-[#6B7280] transition-transform duration-200 ${openSections.authority ? "rotate-180" : ""}`}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Accordion Expanded Content */}
            <AnimatePresence initial={false}>
              {openSections.authority && (
                <motion.div
                  key="content-authority"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div id="section-content-authority" className="px-4 pb-5 sm:px-5 sm:pb-6 pt-1 border-t border-[#E5E7EB]/70 bg-[#FAFAF8]/50 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      {/* Property Document Thumbnail */}
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#111827]">Property Utility Bill</span>
                          {data.authorityDocUrl ? (
                            <span className="text-[10.5px] text-[#065F46] font-semibold flex items-center gap-0.5">
                              <Check size={11} strokeWidth={2.5} /> Attached
                            </span>
                          ) : (
                            <span className="text-[10.5px] text-rose-600 font-semibold">Missing</span>
                          )}
                        </div>

                        <div className="w-full h-34 rounded-lg overflow-hidden bg-stone-100 border border-[#E5E7EB] flex items-center justify-center relative">
                          {data.authorityDocUrl ? (
                            isDocOrPdf(data.authorityDocUrl) ? (
                              <div className="flex flex-col items-center justify-center p-3 text-center">
                                <FileText size={30} className="text-[#065F46] mb-1" />
                                <span className="text-xs font-semibold text-[#111827]">Utility Bill Attached</span>
                                <span className="text-[10.5px] text-[#6B7280]">Water / Electricity (PDF)</span>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={data.authorityDocUrl}
                                alt="Property Utility Bill"
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">No utility bill uploaded</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-[#6B7280]">
                            Water or electricity bill
                          </span>
                          {data.authorityDocUrl && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenPreview("Property Utility Bill", data.authorityDocUrl, e)}
                              className="h-8 px-2.5 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-xs font-medium text-[#065F46] flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>View Document</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bank Account Details */}
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] space-y-3 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-semibold text-[#111827] block mb-2.5">
                            Payout Account
                          </span>

                          <div className="space-y-2 text-xs">
                            <div className="flex items-baseline justify-between border-b border-[#E5E7EB]/50 pb-1.5">
                              <span className="text-[#6B7280]">Bank</span>
                              <span className="font-semibold text-[#111827] text-right truncate max-w-[200px]">
                                {data.bankName || "Not selected"}
                              </span>
                            </div>

                            <div className="flex items-baseline justify-between border-b border-[#E5E7EB]/50 pb-1.5">
                              <span className="text-[#6B7280]">Account Number</span>
                              <span className="font-mono text-[#111827] font-semibold text-right tracking-wider">
                                {maskNumber(data.bankAccountNumber, 4)}
                              </span>
                            </div>

                            <div className="flex items-baseline justify-between border-b border-[#E5E7EB]/50 pb-1.5">
                              <span className="text-[#6B7280]">Account Holder</span>
                              <span className="font-semibold text-[#111827] text-right truncate max-w-[200px]">
                                {data.bankAccountName || "Not provided"}
                              </span>
                            </div>

                            <div className="flex items-baseline justify-between pt-0.5">
                              <span className="text-[#6B7280]">Payout Settlement</span>
                              <span className="text-[11px] font-medium text-[#065F46] text-right">
                                Configured for automated NGN payouts
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <span className="text-[11px] text-[#6B7280] block leading-relaxed">
                            Earnings are credited automatically to this account within 24 hours of guest arrival.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/host/onboarding/authority"
                        className="text-xs font-semibold text-[#065F46] hover:underline flex items-center gap-1"
                      >
                        <span>Edit property &amp; payout details</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* Host Declaration                                           */}
        {/* ────────────────────────────────────────────────────────── */}
        <div
          className={`p-4 sm:p-5 rounded-xl border transition-all duration-150 ${
            termsTouched && !agreedToTerms
              ? "bg-rose-50/50 border-rose-300 ring-1 ring-rose-300"
              : agreedToTerms
              ? "bg-[#F4F7F5] border-[#065F46]/35 ring-1 ring-[#065F46]/20"
              : "bg-white border-[#D1D5DB] hover:border-[#9CA3AF]"
          }`}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="kycDeclarationCheckbox"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              className="w-4.5 h-4.5 mt-0.5 rounded text-[#065F46] focus:ring-[#065F46]/20 accent-[#065F46] shrink-0 cursor-pointer"
            />
            <div className="text-[13px] text-[#111827] leading-relaxed select-none">
              <span className="font-semibold block mb-0.5 text-[#111827]">
                Host declaration
              </span>
              I confirm that the details and documents I have provided are genuine and accurate. I agree to Ilé&apos;s host standards and terms.
            </div>
          </label>

          {termsTouched && !agreedToTerms && (
            <p role="alert" className="text-xs font-medium text-rose-600 mt-2 pl-7.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle size={13} className="shrink-0" />
              <span>Please accept this declaration before submitting your application.</span>
            </p>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* Action Row                                                 */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-[#E5E7EB] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Link
            href="/host/onboarding/authority"
            className="w-full sm:w-auto h-11 px-5 rounded-lg border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white hover:bg-stone-50 active:scale-[0.99] text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to property &amp; payout</span>
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 px-8 rounded-lg bg-[#065F46] hover:bg-[#044E39] active:scale-[0.99] text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Submitting application...</span>
              </>
            ) : (
              <>
                <span>Submit application</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </StepMotion>
  );
}
