"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  UserCheck,
  CreditCard,
  Home,
  FileText,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Camera,
  RefreshCw,
  Lock,
  Building,
  Check,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/auth";
import { api } from "@/lib/api";

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

const NIGERIAN_CITIES = ["Abuja", "Lagos", "Port Harcourt", "Ibadan", "Enugu", "Calabar", "Kaduna"];

const ID_TYPES = [
  { id: "nin", label: "National Identification Number (NIN)", desc: "NIN Slip or Digital NIN Card" },
  { id: "drivers_license", label: "Driver's Licence (FRSC)", desc: "Valid Nigerian Driver's Licence" },
  { id: "passport", label: "International Passport", desc: "Data page of valid Nigerian Passport" },
  { id: "voters_card", label: "Voter's Card (INEC PVC)", desc: "Permanent Voter's Card" },
];

const HOST_TYPES = [
  {
    id: "individual_owner",
    title: "Individual Property Owner",
    desc: "I directly own this property and hold the title deed, C of O, or utility records.",
    docLabel: "Proof of Ownership (Deed of Assignment, C of O, or Recent Utility Bill)",
  },
  {
    id: "property_manager",
    title: "Authorized Property Manager",
    desc: "I am an agent or manager contracted with written authorization to list and host.",
    docLabel: "Management Agreement or Signed Power of Attorney / Mandate Letter",
  },
  {
    id: "company",
    title: "Corporate Entity / Hospitality Brand",
    desc: "The property is managed or owned by a registered Nigerian business entity.",
    docLabel: "CAC Certificate of Incorporation / Business Registration & Board Authorization",
  },
];

export default function OwnerOnboardingWizard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();

  // Wizard Stage:
  // 1 = Account Creation & Email OTP
  // 2 = Tell Us About Yourself & Phone OTP
  // 3 = Identity / KYC (Govt ID + Selfie)
  // 4 = Authority & Nigerian Bank Payouts
  // 5 = Preliminary Property Details & Infrastructure
  // 6 = Review & Submission
  const [currentStage, setCurrentStage] = useState(1);
  const [loadingInitialStatus, setLoadingInitialStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Stage 1 State: Account Creation & Email OTP
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [hostType, setHostType] = useState<"individual_owner" | "property_manager" | "company">("individual_owner");
  const [companyName, setCompanyName] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [resendingEmailOtp, setResendingEmailOtp] = useState(false);

  // Stage 2 State: Personal & Operational Profile
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [operatingCity, setOperatingCity] = useState("Abuja");
  const [operatingAreas, setOperatingAreas] = useState("");
  const [bio, setBio] = useState("");

  // Stage 3 State: Identity & KYC
  const [idType, setIdType] = useState("nin");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState("");
  const [idBackUrl, setIdBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Stage 4 State: Authority Proof & Nigerian Bank Details
  const [companyRegNumber, setCompanyRegNumber] = useState("");
  const [authorityDocType, setAuthorityDocType] = useState("deed_of_ownership");
  const [authorityDocUrl, setAuthorityDocUrl] = useState("");
  const [bankName, setBankName] = useState("Guaranty Trust Bank (GTBank)");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  // Stage 5 State: Property Info & Infrastructure Commitment
  const [propertyTitle, setPropertyTitle] = useState("");
  const [propertyType, setPropertyType] = useState("Apartment");
  const [neighborhood, setNeighborhood] = useState("Maitama");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [nightlyRate, setNightlyRate] = useState(65000);
  const [powerType, setPowerType] = useState("Solar + Inverter with Generator Backup");
  const [commitPower, setCommitPower] = useState(true);
  const [commitSecurity, setCommitSecurity] = useState(true);
  const [commitInternet, setCommitInternet] = useState(true);
  const [commitWater, setCommitWater] = useState(true);

  // Verification Lifecycle & Review State
  const [verificationStatus, setVerificationStatus] = useState("REGISTERED");
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [isApplicationSubmitted, setIsApplicationSubmitted] = useState(false);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadField, setActiveUploadField] = useState<string | null>(null);

  // Load existing onboarding status on mount or when user is authenticated
  useEffect(() => {
    async function loadStatus() {
      if (authLoading) return;

      if (!isAuthenticated || !user) {
        setLoadingInitialStatus(false);
        return;
      }

      try {
        const res = await api.getHostOnboardingStatus();
        if (res && res.user) {
          setFirstName(res.user.firstName || "");
          setLastName(res.user.lastName || "");
          setEmail(res.user.email || "");
          setPhone(res.user.phone || "");
          setEmailVerified(!!res.user.emailVerified);

          if (res.profile) {
            setHostType(res.profile.hostType || "individual_owner");
            setCompanyName(res.profile.companyName || "");
            setCompanyRegNumber(res.profile.companyRegistrationNumber || "");
            setDateOfBirth(res.profile.dateOfBirth || "");
            setResidentialAddress(res.profile.residentialAddress || "");
            setOperatingCity(res.profile.operatingCity || "Abuja");
            setOperatingAreas(res.profile.operatingAreas || "");
            setBio(res.profile.bio || "");
            setIdType(res.profile.idType || "nin");
            setIdNumber(res.profile.idNumber || "");
            setIdFrontUrl(res.profile.identityDocumentUrl || "");
            setIdBackUrl(res.profile.idDocumentBackUrl || "");
            setSelfieUrl(res.profile.selfieUrl || "");
            setAuthorityDocType(res.profile.authorityDocType || "deed_of_ownership");
            setAuthorityDocUrl(res.profile.authorityDocUrl || "");
            setBankName(res.profile.bankName || "Guaranty Trust Bank (GTBank)");
            setBankAccountNumber(res.profile.bankAccountNumber || "");
            setBankAccountName(res.profile.bankAccountName || "");

            if (res.profile.propertyDraftData) {
              try {
                const parsed = JSON.parse(res.profile.propertyDraftData);
                if (parsed.propertyTitle) setPropertyTitle(parsed.propertyTitle);
                if (parsed.propertyType) setPropertyType(parsed.propertyType);
                if (parsed.neighborhood) setNeighborhood(parsed.neighborhood);
                if (parsed.bedrooms) setBedrooms(parsed.bedrooms);
                if (parsed.bathrooms) setBathrooms(parsed.bathrooms);
                if (parsed.nightlyRate) setNightlyRate(parsed.nightlyRate);
                if (parsed.powerType) setPowerType(parsed.powerType);
              } catch {}
            }

            setVerificationStatus(res.profile.verificationStatus || "REGISTERED");
            setReviewFeedback(res.profile.reviewFeedback || null);

            if (
              res.profile.verificationStatus === "UNDER_REVIEW" ||
              res.profile.verificationStatus === "APPROVED"
            ) {
              setIsApplicationSubmitted(true);
              setCurrentStage(6);
            } else if (res.profile.onboardingStep) {
              // Restore user to where they left off
              setCurrentStage(Math.min(res.profile.onboardingStep, 6));
            }
          }
        }
      } catch (err) {
        console.warn("Could not load onboarding status:", err);
      } finally {
        setLoadingInitialStatus(false);
      }
    }

    loadStatus();
  }, [isAuthenticated, user, authLoading]);

  // Handle Image / Document Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadField) return;

    setUploadingDoc(activeUploadField);
    setErrorMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const uploadRes = await api.uploadImage(base64, "kyc");
        if (uploadRes && uploadRes.url) {
          if (activeUploadField === "idFront") setIdFrontUrl(uploadRes.url);
          else if (activeUploadField === "idBack") setIdBackUrl(uploadRes.url);
          else if (activeUploadField === "selfie") setSelfieUrl(uploadRes.url);
          else if (activeUploadField === "authority") setAuthorityDocUrl(uploadRes.url);
          setSuccessMsg("Document uploaded successfully.");
        }
        setUploadingDoc(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload document.");
      setUploadingDoc(null);
    }
  };

  const triggerUpload = (field: string) => {
    setActiveUploadField(field);
    fileInputRef.current?.click();
  };

  // ── Stage 1: Create Owner Account ──
  const handleCreateOwnerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!firstName || !lastName || !email || !password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.registerOwner({
        firstName,
        lastName,
        email,
        phone,
        password,
        hostType,
        companyName: hostType === "company" ? companyName : undefined,
        operatingCity,
      });

      await refreshUser();
      setSuccessMsg("Owner account created! Enter the 6-digit verification code sent to your email.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create owner account.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stage 1: Verify Email OTP ──
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }

    setVerifyingEmail(true);
    setErrorMsg(null);
    try {
      await authApi.verifyEmail(emailOtp.trim());
      setEmailVerified(true);
      await refreshUser();
      setSuccessMsg("Email verified! Let's proceed to personal details.");
      setTimeout(() => {
        setCurrentStage(2);
        setSuccessMsg(null);
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid verification code.");
    } finally {
      setVerifyingEmail(false);
    }
  };

  // ── Stage 1: Resend Email OTP ──
  const handleResendEmailOtp = async () => {
    setResendingEmailOtp(true);
    setErrorMsg(null);
    try {
      await authApi.resendEmailOtp();
      setSuccessMsg("A new verification code has been dispatched to your email.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend code.");
    } finally {
      setResendingEmailOtp(false);
    }
  };



  // ── Stage 2: Save Profile & Move to Step 3 ──
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!residentialAddress || !operatingCity) {
      setErrorMsg("Please enter your residential address and operating city.");
      return;
    }

    setSubmitting(true);
    try {
      await api.updateHostOnboardingProfile({
        firstName,
        lastName,
        phone,
        dateOfBirth,
        residentialAddress,
        operatingCity,
        operatingAreas,
        bio,
      });
      setCurrentStage(3);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save profile.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stage 3: Save KYC & Move to Step 4 ──
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!idNumber) {
      setErrorMsg("Please enter your Government ID / NIN number.");
      return;
    }
    if (!idFrontUrl) {
      setErrorMsg("Please upload a photo of your identity document.");
      return;
    }
    if (!selfieUrl) {
      setErrorMsg("Please upload a verification selfie photo.");
      return;
    }

    setSubmitting(true);
    try {
      await api.updateHostOnboardingIdentity({
        idType,
        idNumber,
        identityDocumentUrl: idFrontUrl,
        idDocumentBackUrl: idBackUrl,
        selfieUrl,
      });
      setCurrentStage(4);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit identity documents.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stage 4: Save Authority & Bank Details & Move to Step 5 ──
  const handleSaveAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!authorityDocUrl) {
      setErrorMsg("Please upload proof of property authority or ownership document.");
      return;
    }
    if (!bankAccountNumber || bankAccountNumber.length < 10) {
      setErrorMsg("Please enter a valid 10-digit Nigerian NUBAN account number.");
      return;
    }
    if (!bankAccountName) {
      setErrorMsg("Please enter the account holder name corresponding to your bank records.");
      return;
    }

    setSubmitting(true);
    try {
      await api.updateHostOnboardingAuthority({
        hostType,
        companyName: hostType === "company" ? companyName : undefined,
        companyRegistrationNumber: hostType === "company" ? companyRegNumber : undefined,
        authorityDocType,
        authorityDocUrl,
        bankName,
        bankAccountNumber,
        bankAccountName,
      });
      setCurrentStage(5);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save authority and bank details.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stage 5: Save Property Draft & Move to Step 6 ──
  const handleSavePropertyDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!propertyTitle) {
      setErrorMsg("Please give your first listing a title.");
      return;
    }
    if (!commitPower || !commitSecurity || !commitInternet || !commitWater) {
      setErrorMsg("You must confirm all Ilé infrastructure quality standards to proceed.");
      return;
    }

    setSubmitting(true);
    try {
      await api.saveHostPropertyDraft({
        propertyTitle,
        propertyType,
        city: operatingCity,
        neighborhood,
        bedrooms,
        bathrooms,
        nightlyRate,
        powerType,
        infrastructureStandards: {
          power: commitPower,
          security: commitSecurity,
          internet: commitInternet,
          water: commitWater,
        },
      });
      setCurrentStage(6);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save initial property details.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stage 6: Final Submission for Admin Review ──
  const handleSubmitApplication = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.submitHostOnboarding();
      setIsApplicationSubmitted(true);
      setVerificationStatus("UNDER_REVIEW");
      setSuccessMsg("Congratulations! Your application has been submitted for review.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitialStatus || authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#0B5D45] mb-4" />
        <p className="text-gray-600 font-medium text-[15px]">Loading partner onboarding dossier...</p>
      </div>
    );
  }

  // Calculate percentage progress
  const progressPct =
    verificationStatus === "APPROVED"
      ? 100
      : verificationStatus === "UNDER_REVIEW"
      ? 95
      : Math.round(((currentStage - 1) / 5) * 85 + 15);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Hidden file input for document and selfie uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,application/pdf"
        className="hidden"
      />

      {/* Top Banner Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#0B5D45]/10 text-[#0B5D45]">
              <ShieldCheck className="w-4 h-4" /> Property Partner Onboarding
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-medium text-gray-900 mt-2">
              List on Ilé with Verified Trust
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Guiding quality property owners and managers through secure verification across Nigeria.
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-gray-500 block">Verification Progress</span>
            <span className="text-xl font-bold text-[#0B5D45]">{progressPct}% Complete</span>
          </div>
        </div>

        {/* Multi-step progress bar */}
        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-[#0B5D45] h-full transition-all duration-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step Indicator Badges */}
        <div className="grid grid-cols-6 gap-1 mt-4 text-center">
          {[
            { num: 1, label: "Account" },
            { num: 2, label: "Profile" },
            { num: 3, label: "Identity" },
            { num: 4, label: "Authority" },
            { num: 5, label: "Listing" },
            { num: 6, label: "Review" },
          ].map((st) => (
            <button
              key={st.num}
              type="button"
              disabled={isApplicationSubmitted && st.num < 6}
              onClick={() => {
                if (st.num <= currentStage || emailVerified) {
                  setCurrentStage(st.num);
                }
              }}
              className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                currentStage === st.num
                  ? "bg-[#0B5D45] text-white shadow-sm"
                  : currentStage > st.num
                  ? "text-[#0B5D45] bg-[#0B5D45]/10 hover:bg-[#0B5D45]/20"
                  : "text-gray-400 bg-gray-100"
              }`}
            >
              <span className="hidden sm:inline">Stage {st.num}: </span>
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div>{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Review Feedback / Rejection Notice */}
      {reviewFeedback && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong>Action Required by Verification Team:</strong>
            <p className="mt-1">{reviewFeedback}</p>
          </div>
        </div>
      )}

      {/* STAGE CONTAINER */}
      <div className="bg-white border border-[#E7E5E0] rounded-2xl shadow-sm p-6 sm:p-8">
        {/* ─── STAGE 1: ACCOUNT CREATION & EMAIL VERIFICATION ─── */}
        {currentStage === 1 && (
          <div>
            <div className="border-b border-gray-100 pb-5 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B5D45]">Stage 1 of 6</span>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">
                Property Owner Account &amp; Email Verification
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Create your partner account. We verify your email address to secure your property administration.
              </p>
            </div>

            {!isAuthenticated || !user ? (
              <form onSubmit={handleCreateOwnerAccount} className="space-y-6">
                {/* Host Type Selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    How are you listing on Ilé?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {HOST_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setHostType(t.id as any)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          hostType === t.id
                            ? "border-[#0B5D45] bg-[#0B5D45]/5 ring-1 ring-[#0B5D45]"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {hostType === "company" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company / Brand Name</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Luxury Suites Ltd"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legal First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="As shown on official ID"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legal Last Name (Surname)</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="As shown on official ID"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (WhatsApp)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0803 123 4567"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Create Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters with numbers or symbols.</p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account & Send Verification Code →"}
                </button>

                <p className="text-center text-xs text-gray-500 mt-2">
                  Already have an owner account?{" "}
                  <Link href="/login?next=/signup" className="text-[#0B5D45] font-semibold underline">
                    Log in here
                  </Link>
                </p>
              </form>
            ) : !emailVerified ? (
              /* Email OTP Verification Sub-step */
              <div className="max-w-md mx-auto text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-[#0B5D45]/10 text-[#0B5D45] flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Check your inbox</h3>
                <p className="text-sm text-gray-600 mt-1">
                  We sent a 6-digit verification code to <strong>{user.email}</strong>.
                </p>

                <div className="mt-6 space-y-4">
                  <input
                    type="text"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-48 mx-auto text-center font-mono text-2xl tracking-widest py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#0B5D45] focus:outline-none"
                  />

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      type="button"
                      disabled={verifyingEmail || emailOtp.length !== 6}
                      onClick={handleVerifyEmailOtp}
                      className="px-6 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {verifyingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Code"}
                    </button>
                    <button
                      type="button"
                      disabled={resendingEmailOtp}
                      onClick={handleResendEmailOtp}
                      className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {resendingEmailOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Resend Code"}
                    </button>
                  </div>

                  <p className="text-xs text-gray-400">
                    Did not receive? Check your spam folder or click Resend Code.
                  </p>
                </div>
              </div>
            ) : (
              /* Already Verified state */
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Email Verified</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {user.email} is confirmed. Continue to your personal and operational profile.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStage(2)}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium inline-flex items-center gap-2"
                >
                  Continue to Personal Profile →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── STAGE 2: TELL US ABOUT YOURSELF & CONTACT DETAILS ─── */}
        {currentStage === 2 && (
          <div>
            <div className="border-b border-gray-100 pb-5 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B5D45]">Stage 2 of 6</span>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">
                Tell Us About Yourself &amp; Contact Details
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                This builds your verified owner identity. Contact details are quarantined and shared only with confirmed guests.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Phone Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone Number (Calls / WhatsApp)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0803 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Used for guest check-in coordination after a reservation is confirmed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Must be at least 18 years old to list property.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Operating City</label>
                  <select
                    value={operatingCity}
                    onChange={(e) => setOperatingCity(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none bg-white"
                  >
                    {NIGERIAN_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Residential / Business Office Address
                </label>
                <input
                  type="text"
                  required
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  placeholder="e.g. 14 Crescent Avenue, Maitama, Abuja"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Neighborhoods / Estates you operate in
                </label>
                <input
                  type="text"
                  value={operatingAreas}
                  onChange={(e) => setOperatingAreas(e.target.value)}
                  placeholder="e.g. Maitama, Wuse 2, Jabi Lake, Victoria Island, Ikoyi"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Host Profile Summary / Bio (Visible to guests)
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell guests about your hospitality philosophy, maintenance standards, and experience..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCurrentStage(1)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Proceed to Identity Verification →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── STAGE 3: IDENTITY / KYC VERIFICATION ─── */}
        {currentStage === 3 && (
          <div>
            <div className="border-b border-gray-100 pb-5 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B5D45]">Stage 3 of 6</span>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">
                Government Identity / KYC Verification
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                We need to know who is listing properties on our platform so we can protect tenants and maintain a trusted marketplace.
              </p>
            </div>

            <form onSubmit={handleSaveIdentity} className="space-y-6">
              {/* ID Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Select Nigerian Government-Issued ID
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ID_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setIdType(t.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        idType === t.id
                          ? "border-[#0B5D45] bg-[#0B5D45]/5 ring-1 ring-[#0B5D45]"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Number (NIN / Licence No. / Passport No.)
                </label>
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="Enter alphanumeric document number"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                />
              </div>

              {/* Document Uploads (Front & Back) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ID Front */}
                <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-gray-400 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Document Front Photo / Scan</p>
                  {idFrontUrl ? (
                    <div className="space-y-2">
                      <img src={idFrontUrl} alt="ID Front" className="h-32 mx-auto rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => triggerUpload("idFront")}
                        className="text-xs text-[#0B5D45] font-semibold underline"
                      >
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <button
                        type="button"
                        disabled={uploadingDoc === "idFront"}
                        onClick={() => triggerUpload("idFront")}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                      >
                        {uploadingDoc === "idFront" ? "Uploading..." : "Upload ID Front"}
                      </button>
                      <p className="text-[11px] text-gray-400 mt-2">JPG, PNG or PDF up to 10MB</p>
                    </div>
                  )}
                </div>

                {/* ID Back (Optional depending on ID) */}
                <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-gray-400 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Document Back Photo (If applicable)</p>
                  {idBackUrl ? (
                    <div className="space-y-2">
                      <img src={idBackUrl} alt="ID Back" className="h-32 mx-auto rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => triggerUpload("idBack")}
                        className="text-xs text-[#0B5D45] font-semibold underline"
                      >
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <button
                        type="button"
                        disabled={uploadingDoc === "idBack"}
                        onClick={() => triggerUpload("idBack")}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                      >
                        {uploadingDoc === "idBack" ? "Uploading..." : "Upload ID Back (Optional)"}
                      </button>
                      <p className="text-[11px] text-gray-400 mt-2">JPG, PNG or PDF up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Selfie / Liveness Photo */}
              <div className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <Camera className="w-5 h-5 text-[#0B5D45] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">Verification Selfie Photo</h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Take a clear photo of your face looking straight at the camera. Ensure good lighting with no hats or sunglasses.
                    </p>

                    <div className="mt-4 flex items-center gap-4">
                      {selfieUrl ? (
                        <div className="flex items-center gap-3">
                          <img src={selfieUrl} alt="Selfie" className="w-16 h-16 rounded-full object-cover border-2 border-[#0B5D45]" />
                          <button
                            type="button"
                            onClick={() => triggerUpload("selfie")}
                            className="text-xs text-[#0B5D45] font-semibold underline"
                          >
                            Retake / Change Selfie
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={uploadingDoc === "selfie"}
                          onClick={() => triggerUpload("selfie")}
                          className="px-4 py-2 bg-[#0B5D45] text-white rounded-lg text-xs font-medium hover:bg-[#084936] flex items-center gap-1.5 shadow-sm"
                        >
                          <Camera className="w-4 h-4" />
                          {uploadingDoc === "selfie" ? "Uploading..." : "Take or Upload Selfie"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCurrentStage(2)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Proceed to Property Authority →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── STAGE 4: AUTHORITY & NIGERIAN BANK PAYOUT DETAILS ─── */}
        {currentStage === 4 && (
          <div>
            <div className="border-b border-gray-100 pb-5 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B5D45]">Stage 4 of 6</span>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">
                Property Authority &amp; Nigerian Bank Payouts
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Distinguish your listing authority (Owner vs Manager vs Company) and connect your Nigerian bank account for automated payouts.
              </p>
            </div>

            <form onSubmit={handleSaveAuthority} className="space-y-6">
              {/* Authority Document Upload */}
              <div className="bg-[#FAFAF8] p-5 rounded-xl border border-gray-200">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Upload Authority / Ownership Credential
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  {HOST_TYPES.find((t) => t.id === hostType)?.docLabel || "Proof of ownership or legal management agreement"}
                </p>

                {authorityDocUrl ? (
                  <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-gray-200">
                    <FileText className="w-8 h-8 text-[#0B5D45]" />
                    <div className="flex-1 truncate">
                      <p className="text-xs font-semibold text-gray-800">Authority Document Attached</p>
                      <a href={authorityDocUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#0B5D45] underline truncate block">
                        {authorityDocUrl}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerUpload("authority")}
                      className="text-xs text-gray-500 hover:text-gray-800 underline"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-gray-300 rounded-xl bg-white">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <button
                      type="button"
                      disabled={uploadingDoc === "authority"}
                      onClick={() => triggerUpload("authority")}
                      className="px-4 py-2 bg-[#0B5D45] text-white rounded-lg text-xs font-medium hover:bg-[#084936]"
                    >
                      {uploadingDoc === "authority" ? "Uploading..." : "Upload Ownership / Authority Document"}
                    </button>
                    <p className="text-[11px] text-gray-400 mt-2">Accepted: Deed, C of O, Utility Bill, or Mandate (PDF, JPG, PNG)</p>
                  </div>
                )}
              </div>

              {/* Nigerian Bank Account Section */}
              <div className="border-t border-gray-200 pt-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#0B5D45]" /> Nigerian Payout Bank Account
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Earnings from confirmed reservations are disbursed directly to this Nigerian bank account via NIBSS / Paystack.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Bank</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none bg-white"
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        10-Digit NUBAN Account Number
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        required
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ""))}
                        placeholder="0123456789"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono tracking-wider focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        required
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                        placeholder="Must match your verified identity"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCurrentStage(3)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Proceed to Property Listing →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── STAGE 5: PROPERTY LISTING & INFRASTRUCTURE STANDARDS ─── */}
        {currentStage === 5 && (
          <div>
            <div className="border-b border-gray-100 pb-5 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B5D45]">Stage 5 of 6</span>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">
                First Property Setup &amp; Infrastructure Standards
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Tell us about your first property and confirm the Ilé Infrastructure Standards that give tenants peace of mind.
              </p>
            </div>

            <form onSubmit={handleSavePropertyDraft} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Listing Title</label>
                <input
                  type="text"
                  required
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  placeholder="e.g. The Olive Residence, Maitama"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none bg-white"
                  >
                    <option value="Apartment">Apartment</option>
                    <option value="Serviced Apartment">Serviced Apartment</option>
                    <option value="House / Duplex">House / Duplex</option>
                    <option value="Studio">Studio</option>
                    <option value="Villa">Villa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neighborhood / District</label>
                  <input
                    type="text"
                    required
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="e.g. Maitama, Wuse 2, Lekki Phase 1"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                  <input
                    type="number"
                    min={1}
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
                  <input
                    type="number"
                    min={1}
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nightly Price (₦ NGN)</label>
                  <input
                    type="number"
                    min={5000}
                    step={1000}
                    value={nightlyRate}
                    onChange={(e) => setNightlyRate(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Power Infrastructure Setup</label>
                <select
                  value={powerType}
                  onChange={(e) => setPowerType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0B5D45] focus:outline-none bg-white"
                >
                  <option value="Solar + Inverter with Generator Backup">Solar + Inverter with Generator Backup</option>
                  <option value="24/7 Dedicated Estate Transformer + Gen">24/7 Dedicated Estate Transformer + Gen</option>
                  <option value="Dual High-Capacity Generators">Dual High-Capacity Generators</option>
                  <option value="Inverter + Central Grid">Inverter + Central Grid</option>
                </select>
              </div>

              {/* Infrastructure Commitment Checklist */}
              <div className="bg-[#FAFAF8] p-5 rounded-xl border border-gray-200 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0B5D45]" /> Ilé Infrastructure Standards Commitment
                </h4>
                <p className="text-xs text-gray-500">
                  Every property on Ilé is booked by guests expecting guaranteed infrastructure. Confirm you provide:
                </p>

                <div className="space-y-2.5 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={commitPower}
                      onChange={(e) => setCommitPower(e.target.checked)}
                      className="w-4 h-4 text-[#0B5D45] rounded border-gray-300 focus:ring-[#0B5D45]"
                    />
                    <span>Guaranteed 24/7 Power (Automatic switchover without prolonged blackouts)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={commitSecurity}
                      onChange={(e) => setCommitSecurity(e.target.checked)}
                      className="w-4 h-4 text-[#0B5D45] rounded border-gray-300 focus:ring-[#0B5D45]"
                    />
                    <span>Active Estate Security / Controlled Gate Access Clearance</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={commitInternet}
                      onChange={(e) => setCommitInternet(e.target.checked)}
                      className="w-4 h-4 text-[#0B5D45] rounded border-gray-300 focus:ring-[#0B5D45]"
                    />
                    <span>High-Speed Fiber or Dedicated Broadband Wi-Fi</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={commitWater}
                      onChange={(e) => setCommitWater(e.target.checked)}
                      className="w-4 h-4 text-[#0B5D45] rounded border-gray-300 focus:ring-[#0B5D45]"
                    />
                    <span>Treated Clean Water with Backup Overhead Storage Tank</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCurrentStage(4)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Proceed to Final Review →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── STAGE 6: FINAL REVIEW & SUBMISSION ─── */}
        {currentStage === 6 && (
          <div>
            <div className="border-b border-gray-100 pb-5 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B5D45]">Stage 6 of 6</span>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">
                Application Review &amp; Approval Status
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Confirm your submitted details before dispatching to the moderation team.
              </p>
            </div>

            {isApplicationSubmitted || verificationStatus === "UNDER_REVIEW" ? (
              /* Already Submitted / Under Review UI */
              <div className="py-8 text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Application Under Priority Review</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  Thank you, <strong>{firstName || user?.firstName}</strong>. Your identity documents, property authority credentials, and Nigerian bank details have been safely received by our compliance team.
                </p>

                <div className="mt-6 bg-[#FAFAF8] border border-gray-200 rounded-xl p-4 text-left space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="font-semibold text-gray-800">Verification Status:</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase tracking-wide">
                      {verificationStatus}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="font-semibold text-gray-800">Estimated Review Time:</span>
                    <span className="text-gray-900 font-medium">Within 24 Hours</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-semibold text-gray-800">Registered Email:</span>
                    <span className="text-gray-900 font-medium">{email || user?.email}</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/host/dashboard"
                    className="px-6 py-3 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium shadow-sm transition-all text-center"
                  >
                    Go to Host Dashboard →
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsApplicationSubmitted(false);
                      setCurrentStage(1);
                    }}
                    className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Review / Edit Details
                  </button>
                </div>
              </div>
            ) : verificationStatus === "APPROVED" ? (
              /* Approved State */
              <div className="py-8 text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">You are a Verified Host!</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Your identity and property credentials have met Ilé standards. You can now publish listings and welcome guests.
                </p>
                <div className="mt-6">
                  <Link
                    href="/host/dashboard"
                    className="px-6 py-3 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-medium shadow-sm inline-block"
                  >
                    Manage Properties in Host Dashboard →
                  </Link>
                </div>
              </div>
            ) : (
              /* Pre-submission Summary Review Cards */
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Account & Profile Summary */}
                  <div className="bg-[#FAFAF8] p-4 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B5D45] mb-2">
                      1. Account &amp; Identity
                    </h4>
                    <p className="text-sm font-semibold text-gray-900">{firstName} {lastName}</p>
                    <p className="text-xs text-gray-600">{email} (Verified: {emailVerified ? "Yes" : "No"})</p>
                    <p className="text-xs text-gray-600">Phone: {phone || "Not specified"}</p>
                    <p className="text-xs text-gray-600 mt-1">{operatingCity} • {residentialAddress}</p>
                  </div>

                  {/* KYC & Identity Summary */}
                  <div className="bg-[#FAFAF8] p-4 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B5D45] mb-2">
                      2. KYC Government Credentials
                    </h4>
                    <p className="text-sm font-semibold text-gray-900 uppercase">{idType}: {idNumber}</p>
                    <p className="text-xs text-emerald-700 font-medium mt-1">
                      ✓ Document Photo Attached • ✓ Selfie Photo Attached
                    </p>
                  </div>

                  {/* Authority & Bank Summary */}
                  <div className="bg-[#FAFAF8] p-4 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B5D45] mb-2">
                      3. Authority &amp; Payout Account
                    </h4>
                    <p className="text-sm font-semibold text-gray-900">
                      {HOST_TYPES.find((t) => t.id === hostType)?.title}
                    </p>
                    <p className="text-xs text-gray-600">{bankName}</p>
                    <p className="text-xs font-mono text-gray-700">Acct: {bankAccountNumber} ({bankAccountName})</p>
                  </div>

                  {/* Property Draft Summary */}
                  <div className="bg-[#FAFAF8] p-4 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B5D45] mb-2">
                      4. Preliminary Property
                    </h4>
                    <p className="text-sm font-semibold text-gray-900">{propertyTitle || "Untitled Listing"}</p>
                    <p className="text-xs text-gray-600">{propertyType} in {neighborhood}, {operatingCity}</p>
                    <p className="text-xs text-[#0B5D45] font-semibold mt-1">₦{nightlyRate.toLocaleString()} / night</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <strong>What happens next:</strong>
                    <p className="mt-0.5 text-blue-800">
                      Our moderation team will review your ID, ownership documentation, and bank details. You will receive an email notification once approved. Once approved, your listings will go live.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStage(5)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Listing
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitApplication}
                    className="px-8 py-3 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-sm font-bold flex items-center gap-2 shadow-md transition-all"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Dossier for Official Approval →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
