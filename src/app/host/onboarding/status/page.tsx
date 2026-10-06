"use client";

import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  FileCheck,
} from "lucide-react";

export default function OnboardingStatusPage() {
  const { data } = useOnboarding();

  const isApproved = data.verificationStatus === "APPROVED";
  const isActionRequired = data.verificationStatus === "ACTION_REQUIRED";

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)] text-center max-w-2xl mx-auto">
      {/* Icon Badge */}
      <div className="flex justify-center mb-6">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isApproved
              ? "bg-[#EDF5F2] text-[#0B5D45]"
              : isActionRequired
              ? "bg-amber-100 text-amber-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {isApproved ? (
            <CheckCircle2 size={36} />
          ) : isActionRequired ? (
            <AlertTriangle size={36} />
          ) : (
            <Clock size={36} />
          )}
        </div>
      </div>

      {/* Headline & Status */}
      <div className="space-y-2 mb-6">
        <span
          className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            isApproved
              ? "bg-emerald-100 text-emerald-800"
              : isActionRequired
              ? "bg-amber-100 text-amber-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {data.verificationStatus || "UNDER_REVIEW"}
        </span>

        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight">
          {isApproved
            ? "Your Partner Account is Approved!"
            : isActionRequired
            ? "Action Required on Your Documents"
            : "Your Verification Dossier is Under Review"}
        </h1>

        <p className="text-[15px] text-[#6B6B67] leading-relaxed max-w-lg mx-auto">
          {isApproved
            ? "Congratulations! Your account has passed physical verification and KYC inspection. You can now publish listings and accept bookings."
            : isActionRequired
            ? data.reviewFeedback ||
              "Our compliance team requires additional information to approve your account. Please update your submitted documents."
            : "Thank you for completing your partner onboarding! Our physical verification team in Abuja/Lagos is auditing your documents and location parameters."}
        </p>
      </div>

      {/* Review Dossier Overview Box */}
      <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] text-left space-y-3 mb-8">
        <h4 className="text-[13px] font-bold text-[#171717] uppercase tracking-wider flex items-center gap-2">
          <FileCheck size={16} className="text-[#0B5D45]" />
          <span>Submitted Verification Dossier</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#6B6B67]">
          <div>
            <span className="font-semibold text-[#171717]">Identity: </span>
            {data.idType.toUpperCase()} ({data.idNumber || "Uploaded"})
          </div>
          <div>
            <span className="font-semibold text-[#171717]">Payout Bank: </span>
            {data.bankName}
          </div>
          <div>
            <span className="font-semibold text-[#171717]">Operating City: </span>
            {data.operatingCity}
          </div>
          <div>
            <span className="font-semibold text-[#171717]">Draft Listing: </span>
            {data.propertyTitle || "Initial property draft created"}
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {isActionRequired ? (
          <Link
            href="/host/onboarding/identity"
            className="w-full sm:w-auto h-[50px] px-8 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <span>Update Submitted Documents</span>
            <ArrowRight size={16} />
          </Link>
        ) : (
          <Link
            href="/host/dashboard"
            className="w-full sm:w-auto h-[50px] px-8 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <span>Go to Host Dashboard</span>
            <ArrowRight size={16} />
          </Link>
        )}
      </div>

      {/* Concierge Support Contact */}
      <div className="mt-8 pt-6 border-t border-[#E7E5E0] text-xs text-[#8B8B86]">
        Questions regarding physical verification? Contact Ilé Verification Desk:{" "}
        <a href="mailto:verify@ile.ng" className="text-[#0B5D45] font-semibold underline">
          verify@ile.ng
        </a>{" "}
        or call <span className="font-semibold text-[#171717]">+234 800 453 7829</span>.
      </div>
    </div>
  );
}
