"use client";

import { useState, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import PrimaryButton from "@/components/auth/PrimaryButton";
import FormAlert from "@/components/auth/FormAlert";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/auth";
import { RotateCw, LogOut, ArrowRight } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/host/onboarding";
  const { user, refreshUser, logout } = useAuth();

  // Phase: "register" | "verify"
  const [phase, setPhase] = useState<"register" | "verify">("register");

  // Registration form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // OTP Verification state
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Status and error handling
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    otp?: string;
  }>({});

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otpCode];
    newOtp[index] = digit;
    setOtpCode(newOtp);
    if (fieldErrors.otp) setFieldErrors({ ...fieldErrors, otp: "" });

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasteData) return;
    const newOtp = [...otpCode];
    for (let i = 0; i < pasteData.length; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtpCode(newOtp);
    const nextIdx = Math.min(pasteData.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  const validateRegistration = () => {
    const errors: typeof fieldErrors = {};
    if (!firstName.trim()) errors.firstName = "Please enter your first name.";
    if (!lastName.trim()) errors.lastName = "Please enter your last name.";
    if (!email.trim()) {
      errors.email = "Please enter your email address.";
    } else if (!email.includes("@") || !email.includes(".")) {
      errors.email = "Please enter a valid email address.";
    }
    if (!password) {
      errors.password = "Please enter a password.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateRegistration()) return;

    setIsLoading(true);
    try {
      await authApi.registerOwner({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      // Successfully registered unverified account; OTP has been dispatched.
      // Transition to verification phase without establishing session until OTP succeeds.
      setPhase("verify");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to create partner account. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const fullCode = otpCode.join("");
    if (fullCode.length < 6) {
      setFieldErrors({ otp: "Please enter the complete 6-digit verification code." });
      return;
    }

    setIsLoading(true);
    try {
      await authApi.verifyEmail(fullCode, email.trim().toLowerCase());
      await refreshUser();
      router.push(nextUrl || "/host/onboarding/business-type");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification code incorrect or expired.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setResendSuccess(false);
    setErrorMessage(null);
    try {
      await authApi.resendEmailOtp(email.trim().toLowerCase());
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend code. Please try again.";
      setErrorMessage(msg);
    } finally {
      setResending(false);
    }
  };

  // ── Render Phase 2: Verify Email ──
  if (phase === "verify") {
    return (
      <AuthLayout
        heading="Verify your email"
        supportingText={`We've sent a 6-digit verification code to ${email || "your email"}. Enter it below to continue.`}
        imageAlt="Modern Nigerian residence with warm natural light"
      >
        <div className="space-y-6">
          {errorMessage && <FormAlert type="error" message={errorMessage} />}
          {resendSuccess && (
            <FormAlert
              type="success"
              message="A new 6-digit verification code has been dispatched to your email."
            />
          )}

          <form onSubmit={handleVerifySubmit} className="space-y-6" noValidate>
            <div>
              <label className="block text-[13px] font-semibold text-[#171717] mb-3">
                6-Digit Verification Code
              </label>

              {/* 6 Digit Inputs */}
              <div className="flex items-center justify-between gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    disabled={isLoading}
                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white text-[#111827] focus:outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 transition-colors duration-150 shadow-xs"
                  />
                ))}
              </div>

              {fieldErrors.otp && (
                <p className="text-[12.5px] text-rose-600 font-medium mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {fieldErrors.otp}
                </p>
              )}
            </div>

            <div className="pt-2">
              <PrimaryButton type="submit" isLoading={isLoading} loadingText="Verifying code...">
                Verify and continue →
              </PrimaryButton>
            </div>
          </form>

          {/* Resend and help options */}
          <div className="space-y-3 pt-2 text-center text-[13.5px]">
            <div className="flex items-center justify-center gap-1.5 text-[#6B6B67]">
              <span>Didn&apos;t receive the code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || isLoading}
                className="font-semibold text-[#065F46] hover:text-[#044E39] hover:underline inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {resending ? (
                  <>
                    <RotateCw size={13} className="animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Resend code</span>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-[#E7E5E0]">
              <button
                type="button"
                onClick={() => setPhase("register")}
                className="text-[13px] font-medium text-[#6B6B67] hover:text-[#171717] hover:underline cursor-pointer"
              >
                ← Back to registration details
              </button>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ── Render Phase 1: Clean Partner Account Creation ──
  return (
    <AuthLayout
      heading="Become an Ilé Property Partner"
      supportingText="Create your account to start listing your property on Ilé."
      imageAlt="Curated Ilé Living Exhibition"
      imageSrc="/images/auth-partner-showcase.png"
    >
      <div className="space-y-4">
        {/* Active Session Notification (if user already logged in) */}
        {user && (
          <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col gap-2">
            <div className="text-[13px] text-[#166534]">
              You are currently signed in as <span className="font-semibold">{user.email}</span>.
            </div>
            <div className="flex items-center gap-4 text-[12.5px]">
              <Link
                href={nextUrl || "/host/onboarding"}
                className="font-semibold text-[#065F46] hover:text-[#044E39] inline-flex items-center gap-1 hover:underline"
              >
                <span>Continue to Host Workspace</span>
                <ArrowRight size={13} />
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                }}
                className="text-[#4B5563] hover:text-[#111827] inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                <LogOut size={12} />
                <span>Sign out to create new account</span>
              </button>
            </div>
          </div>
        )}

        {errorMessage && <FormAlert type="error" message={errorMessage} />}

        <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
          {/* Name Fields (Side by Side in 2-column inline grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <AuthInput
              label="First Name"
              type="text"
              placeholder="e.g. Aliko"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: "" });
              }}
              autoComplete="given-name"
              error={fieldErrors.firstName}
              disabled={isLoading}
              required
            />

            <AuthInput
              label="Last Name"
              type="text"
              placeholder="e.g. Mohammed"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: "" });
              }}
              autoComplete="family-name"
              error={fieldErrors.lastName}
              disabled={isLoading}
              required
            />
          </div>

          {/* Email Address */}
          <AuthInput
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
            }}
            autoComplete="email"
            error={fieldErrors.email}
            disabled={isLoading}
            required
          />

          {/* Password with Eye Toggle Mechanism */}
          <div>
            <PasswordInput
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
              }}
              autoComplete="new-password"
              error={fieldErrors.password}
              disabled={isLoading}
              required
            />
            {password && <PasswordStrength password={password} />}
          </div>

          {/* Clean disclaimer matching corporate terms guidelines */}
          <div className="text-[12px] text-[#4B5563] leading-relaxed pt-0.5">
            By creating an account, you agree to Ilé&apos;s{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-[#111827]">
              Partner Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[#111827]">
              Privacy Policy
            </Link>
            .
          </div>

          {/* Primary CTA Submit Button */}
          <div className="pt-1">
            <PrimaryButton type="submit" isLoading={isLoading} loadingText="Creating account...">
              Create account →
            </PrimaryButton>
          </div>
        </form>

        {/* Alternative Route: Subtle Bottom Redirect */}
        <div className="pt-2 text-center text-[13px] text-[#4B5563]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-[#111827] hover:text-[#1C3D32] transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF8]" />}>
      <SignupForm />
    </Suspense>
  );
}
