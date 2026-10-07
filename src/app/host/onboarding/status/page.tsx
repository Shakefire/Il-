"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  Pencil,
  X,
  CreditCard,
  MapPin,
  Home,
  Upload,
  Check,
  Loader2,
  Eye,
  FileText,
  User,
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

const ID_TYPE_LABELS: Record<string, string> = {
  nin: "National Identification Number (NIN)",
  drivers_license: "Driver's Licence (FRSC)",
  passport: "International Passport",
  voters_card: "Voter's Card (INEC PVC)",
};

type EditSection = "identity" | "bank" | "profile" | "property" | null;

export default function OnboardingStatusPage() {
  const { data, updateData } = useOnboarding();

  const isApproved = data.verificationStatus === "APPROVED";
  const isActionRequired = data.verificationStatus === "ACTION_REQUIRED";

  // Drawer state
  const [activeSection, setActiveSection] = useState<EditSection>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Edit draft states
  const [editIdentity, setEditIdentity] = useState({
    idType: data.idType || "nin",
    idNumber: data.idNumber || "",
    idFrontUrl: data.idFrontUrl || "",
    idBackUrl: data.idBackUrl || "",
  });

  const [editBank, setEditBank] = useState({
    bankName: data.bankName || "Guaranty Trust Bank (GTBank)",
    bankAccountNumber: data.bankAccountNumber || "",
    bankAccountName: data.bankAccountName || "",
  });

  const [editProfile, setEditProfile] = useState({
    operatingCity: data.operatingCity || "Abuja",
    operatingAreas: data.operatingAreas || "",
    phone: data.phone || "",
    bio: data.bio || "",
  });

  const [editProperty, setEditProperty] = useState({
    propertyTitle: data.propertyTitle || "",
    propertyType: data.propertyType || "Apartment",
    neighborhood: data.neighborhood || "",
    nightlyRate: data.nightlyRate || 65000,
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

  // File upload state for drawer
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetField, setUploadTargetField] = useState<"idFrontUrl" | "idBackUrl">("idFrontUrl");
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const handleOpenEdit = (section: EditSection) => {
    setDrawerError(null);
    setSaveSuccess(false);

    if (section === "identity") {
      setEditIdentity({
        idType: data.idType || "nin",
        idNumber: data.idNumber || "",
        idFrontUrl: data.idFrontUrl || "",
        idBackUrl: data.idBackUrl || "",
      });
    } else if (section === "bank") {
      setEditBank({
        bankName: data.bankName || "Guaranty Trust Bank (GTBank)",
        bankAccountNumber: data.bankAccountNumber || "",
        bankAccountName: data.bankAccountName || "",
      });
    } else if (section === "profile") {
      setEditProfile({
        operatingCity: data.operatingCity || "Abuja",
        operatingAreas: data.operatingAreas || "",
        phone: data.phone || "",
        bio: data.bio || "",
      });
    } else if (section === "property") {
      setEditProperty({
        propertyTitle: data.propertyTitle || "",
        propertyType: data.propertyType || "Apartment",
        neighborhood: data.neighborhood || "",
        nightlyRate: data.nightlyRate || 65000,
      });
    }

    setActiveSection(section);
  };

  const handleTriggerUpload = (field: "idFrontUrl" | "idBackUrl") => {
    setUploadTargetField(field);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setDrawerError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB limit.`);
      return;
    }

    setIsUploadingFile(true);
    setDrawerError(null);

    try {
      const compressedDataUrl = await compressFile(file);
      try {
        const res = await api.uploadImage(compressedDataUrl, "kyc");
        const url = res.url || compressedDataUrl;
        setEditIdentity((prev) => ({ ...prev, [uploadTargetField]: url }));
      } catch {
        setEditIdentity((prev) => ({ ...prev, [uploadTargetField]: compressedDataUrl }));
      }
    } catch (err: any) {
      setDrawerError(err.message || "Failed to process image.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSaveDrawer = async () => {
    setIsSaving(true);
    setDrawerError(null);

    try {
      if (activeSection === "identity") {
        await api.updateHostOnboardingIdentity({
          idType: editIdentity.idType,
          idNumber: editIdentity.idNumber,
          idFrontUrl: editIdentity.idFrontUrl,
          identityDocumentUrl: editIdentity.idFrontUrl,
          idBackUrl: editIdentity.idBackUrl,
          idDocumentBackUrl: editIdentity.idBackUrl,
          selfieUrl: data.selfieUrl,
        });
        updateData(editIdentity);
      } else if (activeSection === "bank") {
        if (!editBank.bankAccountNumber || editBank.bankAccountNumber.length < 10) {
          throw new Error("Please enter a valid 10-digit NUBAN account number.");
        }
        await api.updateHostOnboardingAuthority({
          authorityDocType: data.authorityDocType,
          authorityDocUrl: data.authorityDocUrl,
          bankName: editBank.bankName,
          bankAccountNumber: editBank.bankAccountNumber,
          bankAccountName: editBank.bankAccountName,
        });
        updateData(editBank);
      } else if (activeSection === "profile") {
        await api.updateHostOnboardingProfile({
          operatingCity: editProfile.operatingCity,
          operatingAreas: editProfile.operatingAreas,
          phone: editProfile.phone,
          bio: editProfile.bio,
        });
        updateData(editProfile);
      } else if (activeSection === "property") {
        await api.saveHostPropertyDraft({
          title: editProperty.propertyTitle,
          propertyType: editProperty.propertyType,
          neighborhood: editProperty.neighborhood,
          nightlyRate: Number(editProperty.nightlyRate),
          city: data.operatingCity,
        });
        updateData(editProperty);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setActiveSection(null);
        setSaveSuccess(false);
      }, 700);
    } catch (err: any) {
      setDrawerError(err.message || "Failed to update information. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Stagger reveal variants
  const dossierContainerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const dossierItemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)] text-center max-w-2xl mx-auto relative">
      {/* Hidden file input for document updates in drawer */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Waiting State Animation & Icon Badge */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          {!isApproved && !isActionRequired && (
            <span
              className="absolute -inset-1.5 rounded-full bg-blue-400/20 animate-ping pointer-events-none"
              aria-hidden="true"
            />
          )}
          <motion.div
            animate={
              !isApproved && !isActionRequired
                ? { scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }
                : {}
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className={`relative w-16 h-16 rounded-full flex items-center justify-center ${
              isApproved
                ? "bg-[#EDF5F2] text-[#0B5D45]"
                : isActionRequired
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-50 text-blue-700 border border-blue-200/60"
            }`}
          >
            {isApproved ? (
              <CheckCircle2 size={34} />
            ) : isActionRequired ? (
              <AlertTriangle size={34} />
            ) : (
              <Clock size={34} />
            )}
          </motion.div>
        </div>
      </div>

      {/* Human-Readable Status Badge & Headline */}
      <div className="space-y-2 mb-6">
        <div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isApproved
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : isActionRequired
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-blue-50 text-blue-700 border border-blue-200/80"
            }`}
          >
            {!isApproved && !isActionRequired && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            )}
            <span>
              {isApproved
                ? "Verified & Approved"
                : isActionRequired
                ? "Action Required"
                : "Review in Progress"}
            </span>
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight">
          {isApproved
            ? "Your Partner Account is Approved!"
            : isActionRequired
            ? "Action Required on Your Documents"
            : "Your Verification Dossier is Under Review"}
        </h1>

        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed max-w-lg mx-auto">
          {isApproved
            ? "Congratulations! Your account has passed compliance verification. You can now publish listings and accept guest bookings."
            : isActionRequired
            ? data.reviewFeedback ||
              "Our compliance team requires additional information to approve your account. Please update your submitted documents below."
            : "Thank you for completing your partner onboarding! Our physical verification team in Abuja and Lagos is auditing your submitted documents and parameters."}
        </p>
      </div>

      {/* Interactive Submitted Dossier Overview Box */}
      <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] text-left mb-8 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E0]/80 mb-3">
          <h4 className="text-[12.5px] font-bold text-[#171717] uppercase tracking-wider flex items-center gap-2">
            <FileCheck size={16} className="text-[#0B5D45]" />
            <span>Submitted Verification Dossier</span>
          </h4>
          <span className="text-[11px] text-[#8B8B86] font-medium hidden sm:inline-block">
            Editable during review
          </span>
        </div>

        <motion.div
          variants={dossierContainerVariants}
          initial="hidden"
          animate="show"
          className="space-y-2.5"
        >
          {/* Identity Document Row */}
          <motion.div
            variants={dossierItemVariants}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#E7E5E0] hover:border-stone-300 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-[#6B6B67] shrink-0 mt-0.5">
                <CreditCard size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-[#8B8B86] uppercase tracking-wider block">
                  Identity Document
                </span>
                <div className="text-xs font-semibold text-[#171717] truncate mt-0.5">
                  {ID_TYPE_LABELS[data.idType] || data.idType.toUpperCase()}
                  {data.idNumber && (
                    <span className="text-[#6B6B67] font-normal ml-1">
                      • {data.idNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {data.idFrontUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          isOpen: true,
                          title: "Identity Document (Front)",
                          url: data.idFrontUrl,
                        })
                      }
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-medium hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <Eye size={10} />
                      <span>Front Doc</span>
                    </button>
                  )}
                  {data.idBackUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          isOpen: true,
                          title: "Identity Document (Back)",
                          url: data.idBackUrl,
                        })
                      }
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px] font-medium hover:bg-stone-200 transition-colors cursor-pointer"
                    >
                      <Eye size={10} />
                      <span>Back Doc</span>
                    </button>
                  )}
                  {data.selfieUrl && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                      <ShieldCheck size={10} />
                      <span>Liveness Verified</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenEdit("identity")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#0B5D45] hover:bg-[#0B5D45]/8 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Edit identity information"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
          </motion.div>

          {/* Payout Bank Row */}
          <motion.div
            variants={dossierItemVariants}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#E7E5E0] hover:border-stone-300 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-[#6B6B67] shrink-0 mt-0.5">
                <Building2 size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-[#8B8B86] uppercase tracking-wider block">
                  Payout Bank
                </span>
                <div className="text-xs font-semibold text-[#171717] truncate mt-0.5">
                  {data.bankName || "Bank not set"}
                </div>
                <div className="text-[11px] text-[#6B6B67] mt-0.5 truncate">
                  {data.bankAccountNumber ? (
                    <span>
                      NUBAN: {data.bankAccountNumber}
                      {data.bankAccountName ? ` • ${data.bankAccountName}` : ""}
                    </span>
                  ) : (
                    <span className="italic text-[#8B8B86]">Account details pending</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenEdit("bank")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#0B5D45] hover:bg-[#0B5D45]/8 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Edit payout bank"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
          </motion.div>

          {/* Operating Location Row */}
          <motion.div
            variants={dossierItemVariants}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#E7E5E0] hover:border-stone-300 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-[#6B6B67] shrink-0 mt-0.5">
                <MapPin size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-[#8B8B86] uppercase tracking-wider block">
                  Operating City & Contact
                </span>
                <div className="text-xs font-semibold text-[#171717] truncate mt-0.5">
                  {data.operatingCity}
                  {data.operatingAreas ? ` (${data.operatingAreas})` : ""}
                </div>
                <div className="text-[11px] text-[#6B6B67] mt-0.5 truncate">
                  Phone: {data.phone || "Not specified"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenEdit("profile")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#0B5D45] hover:bg-[#0B5D45]/8 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Edit operating details"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
          </motion.div>

          {/* Draft Listing Row */}
          <motion.div
            variants={dossierItemVariants}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#E7E5E0] hover:border-stone-300 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-[#6B6B67] shrink-0 mt-0.5">
                <Home size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-[#8B8B86] uppercase tracking-wider block">
                  Draft Property Listing
                </span>
                <div className="text-xs font-semibold text-[#171717] truncate mt-0.5">
                  {data.propertyTitle || "Initial property draft created"}
                </div>
                <div className="text-[11px] text-[#6B6B67] mt-0.5 truncate">
                  {data.propertyType} • {data.neighborhood || data.operatingCity}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenEdit("property")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#0B5D45] hover:bg-[#0B5D45]/8 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Edit property draft"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
          </motion.div>
        </motion.div>
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

      {/* Elevated Concierge Support Micro-Card */}
      <div className="mt-8 pt-6 border-t border-[#E7E5E0] text-left">
        <div className="bg-[#FAFAF8] border border-[#E7E5E0] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#E7E5E0] flex items-center justify-center text-[#0B5D45] shrink-0 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-[13.5px] font-semibold text-[#171717]">
                Need Help with Verification?
              </h4>
              <p className="text-xs text-[#6B6B67] mt-0.5 leading-relaxed">
                Our physical compliance officers in Abuja & Lagos are on standby to inspect properties and verify documents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 pl-1 md:pl-0">
            <a
              href="mailto:verify@ile.ng"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E7E5E0] hover:bg-stone-50 text-xs font-semibold text-[#171717] transition-all shadow-xs"
            >
              <Mail size={13} className="text-[#0B5D45]" />
              <span>verify@ile.ng</span>
            </a>
            <a
              href="tel:+2348004537829"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E7E5E0] hover:bg-stone-50 text-xs font-semibold text-[#171717] transition-all shadow-xs"
            >
              <Phone size={13} className="text-[#0B5D45]" />
              <span>+234 800 453 7829</span>
            </a>
          </div>
        </div>
      </div>

      {/* Right-Side Interactive Edit Drawer */}
      <AnimatePresence>
        {activeSection && (
          <div className="fixed inset-0 z-50 overflow-hidden text-left">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !isSaving && setActiveSection(null)}
              className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-white shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#E7E5E0] flex items-center justify-between bg-white">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B5D45] block">
                    Update Submission
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-[#171717] mt-0.5">
                    {activeSection === "identity" && "Update Identity Information"}
                    {activeSection === "bank" && "Update Payout Bank Details"}
                    {activeSection === "profile" && "Update Operating Location"}
                    {activeSection === "property" && "Update Property Draft"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !isSaving && setActiveSection(null)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-white text-xs">
                {/* Notice pill */}
                <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-blue-900 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Active Queue Protected</span>
                  Amending these details updates your compliance file immediately without resetting your place in the verification review queue.
                </div>

                {drawerError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                    {drawerError}
                  </div>
                )}

                {/* 1. Identity Section */}
                {activeSection === "identity" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Document Type
                      </label>
                      <select
                        value={editIdentity.idType}
                        onChange={(e) =>
                          setEditIdentity((prev) => ({ ...prev, idType: e.target.value }))
                        }
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      >
                        <option value="nin">National Identification Number (NIN)</option>
                        <option value="drivers_license">Driver's Licence (FRSC)</option>
                        <option value="passport">International Passport</option>
                        <option value="voters_card">Voter's Card (INEC PVC)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        ID Document Number
                      </label>
                      <input
                        type="text"
                        value={editIdentity.idNumber}
                        onChange={(e) =>
                          setEditIdentity((prev) => ({ ...prev, idNumber: e.target.value }))
                        }
                        placeholder="e.g. 11-digit NIN or Licence Number"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>

                    <div className="pt-2 border-t border-[#E7E5E0] space-y-3">
                      <span className="font-semibold text-[#171717] block">
                        Upload Replacement Documents (Max 15MB)
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8]">
                          <div>
                            <span className="font-semibold text-[#171717] block">
                              Front Document
                            </span>
                            <span className="text-[11px] text-[#8B8B86]">
                              {editIdentity.idFrontUrl ? "Document on file" : "Not uploaded"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTriggerUpload("idFrontUrl")}
                            disabled={isUploadingFile}
                            className="px-3 py-1.5 rounded-lg border border-[#E7E5E0] bg-white hover:bg-stone-50 text-xs font-semibold text-[#171717] transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload size={13} className="text-[#0B5D45]" />
                            <span>{editIdentity.idFrontUrl ? "Replace" : "Upload"}</span>
                          </button>
                        </div>

                        {editIdentity.idType !== "passport" && (
                          <div className="flex items-center justify-between p-3 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8]">
                            <div>
                              <span className="font-semibold text-[#171717] block">
                                Back Document (Optional)
                              </span>
                              <span className="text-[11px] text-[#8B8B86]">
                                {editIdentity.idBackUrl ? "Document on file" : "Not uploaded"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTriggerUpload("idBackUrl")}
                              disabled={isUploadingFile}
                              className="px-3 py-1.5 rounded-lg border border-[#E7E5E0] bg-white hover:bg-stone-50 text-xs font-semibold text-[#171717] transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Upload size={13} className="text-[#0B5D45]" />
                              <span>{editIdentity.idBackUrl ? "Replace" : "Upload"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Bank Section */}
                {activeSection === "bank" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Settlement Bank
                      </label>
                      <select
                        value={editBank.bankName}
                        onChange={(e) =>
                          setEditBank((prev) => ({ ...prev, bankName: e.target.value }))
                        }
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      >
                        {NIGERIAN_BANKS.map((bank) => (
                          <option key={bank} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        NUBAN Account Number (10 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={editBank.bankAccountNumber}
                        onChange={(e) =>
                          setEditBank((prev) => ({
                            ...prev,
                            bankAccountNumber: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder="0123456789"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs font-mono focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={editBank.bankAccountName}
                        onChange={(e) =>
                          setEditBank((prev) => ({ ...prev, bankAccountName: e.target.value }))
                        }
                        placeholder="Full name as registered on account"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* 3. Profile / Operating Section */}
                {activeSection === "profile" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Primary Operating City
                      </label>
                      <select
                        value={editProfile.operatingCity}
                        onChange={(e) =>
                          setEditProfile((prev) => ({ ...prev, operatingCity: e.target.value }))
                        }
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      >
                        <option value="Abuja">Abuja (FCT)</option>
                        <option value="Lagos">Lagos State</option>
                        <option value="Port Harcourt">Port Harcourt (Rivers)</option>
                        <option value="Ibadan">Ibadan (Oyo)</option>
                        <option value="Enugu">Enugu State</option>
                        <option value="Calabar">Calabar (Cross River)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Operating Neighborhoods / Areas
                      </label>
                      <input
                        type="text"
                        value={editProfile.operatingAreas}
                        onChange={(e) =>
                          setEditProfile((prev) => ({ ...prev, operatingAreas: e.target.value }))
                        }
                        placeholder="e.g. Maitama, Wuse 2, Jabi or Ikoyi, Lekki"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Contact Phone Number
                      </label>
                      <input
                        type="tel"
                        value={editProfile.phone}
                        onChange={(e) =>
                          setEditProfile((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="+234 800 000 0000"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Host Bio / Description
                      </label>
                      <textarea
                        rows={3}
                        value={editProfile.bio}
                        onChange={(e) =>
                          setEditProfile((prev) => ({ ...prev, bio: e.target.value }))
                        }
                        placeholder="Share your hosting experience or background..."
                        className="w-full p-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Property Section */}
                {activeSection === "property" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Property Listing Title
                      </label>
                      <input
                        type="text"
                        value={editProperty.propertyTitle}
                        onChange={(e) =>
                          setEditProperty((prev) => ({ ...prev, propertyTitle: e.target.value }))
                        }
                        placeholder="e.g. Luxurious 2-Bed Serviced Apartment"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Property Type
                      </label>
                      <select
                        value={editProperty.propertyType}
                        onChange={(e) =>
                          setEditProperty((prev) => ({ ...prev, propertyType: e.target.value }))
                        }
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      >
                        <option value="Apartment">Apartment</option>
                        <option value="Duplex">Duplex / Villa</option>
                        <option value="Penthouse">Penthouse</option>
                        <option value="Studio">Studio</option>
                        <option value="Terrace">Terrace House</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Neighborhood
                      </label>
                      <input
                        type="text"
                        value={editProperty.neighborhood}
                        onChange={(e) =>
                          setEditProperty((prev) => ({ ...prev, neighborhood: e.target.value }))
                        }
                        placeholder="e.g. Maitama or Victoria Island"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#171717] block mb-1.5">
                        Nightly Rate (₦)
                      </label>
                      <input
                        type="number"
                        value={editProperty.nightlyRate}
                        onChange={(e) =>
                          setEditProperty((prev) => ({
                            ...prev,
                            nightlyRate: Number(e.target.value),
                          }))
                        }
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-xs focus:outline-none focus:border-[#0B5D45] focus:bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-[#E7E5E0] bg-white hover:bg-stone-100 text-xs font-semibold text-[#6B6B67] transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveDrawer}
                  disabled={isSaving || isUploadingFile}
                  className="px-5 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check size={13} />
                      <span>Updated!</span>
                    </>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Save & Update</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, title: "", url: "" })}
        title={previewModal.title}
        url={previewModal.url}
      />
    </div>
  );
}
