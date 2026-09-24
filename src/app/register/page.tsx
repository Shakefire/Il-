"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import PhoneInput from "@/components/auth/PhoneInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import SocialButton from "@/components/auth/SocialButton";
import AuthDivider from "@/components/auth/AuthDivider";
import FormAlert from "@/components/auth/FormAlert";
import { useAuth } from "@/context/AuthContext";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const { register } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = "Please enter your first name.";
    if (!lastName.trim()) errors.lastName = "Please enter your last name.";

    if (!email.trim()) {
      errors.email = "Please enter your email address.";
    } else if (!email.includes("@") || !email.includes(".")) {
      errors.email = "Please enter a valid email address.";
    }

    if (!phone.trim()) {
      errors.phone = "Please enter your phone number.";
    } else if (phone.replace(/\D/g, "").length < 10) {
      errors.phone = "Please enter a valid 10 or 11-digit phone number.";
    }

    if (!password) {
      errors.password = "Please create a password.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      await register({
        firstName,
        lastName,
        email,
        phone: `+234${phone.replace(/^0+/, "")}`,
        password,
      });

      setIsSuccess(true);
      setTimeout(() => {
        router.push(nextUrl);
      }, 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to create account. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setSocialLoading(true);
    setErrorMessage(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      router.push(nextUrl);
    } catch {
      setErrorMessage("Unable to connect with Google. Please try again.");
    } finally {
      setSocialLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Create your account."
      supportingText="Find and book places that feel like home."
      imageAlt="Tasteful modern bedroom in an Abuja shortlet"
    >
      <div className="space-y-6">
        {/* Success confirmation */}
        {isSuccess && (
          <div className="space-y-4">
            <FormAlert
              type="success"
              message="Account created successfully. You're ready to start exploring."
            />
            <div className="pt-2">
              <Link
                href={nextUrl}
                className="inline-flex items-center justify-center w-full h-[52px] bg-[#0B5D45] text-white rounded-[11px] font-medium text-[15px] hover:bg-[#084936] transition-colors"
              >
                Continue to stays →
              </Link>
            </div>
          </div>
        )}

        {!isSuccess && (
          <>
            {/* Error Alert */}
            {errorMessage && <FormAlert type="error" message={errorMessage} />}

            <form onSubmit={handleRegister} className="space-y-4" noValidate>
              {/* First & Last Name side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <AuthInput
                  label="First Name"
                  placeholder="Amina"
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
                  placeholder="Bello"
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

              {/* Email */}
              <AuthInput
                label="Email"
                type="email"
                placeholder="amina@example.com"
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

              {/* Phone */}
              <PhoneInput
                label="Phone Number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: "" });
                }}
                error={fieldErrors.phone}
                disabled={isLoading}
                required
              />

              {/* Password */}
              <div>
                <PasswordInput
                  label="Password"
                  placeholder="Create a secure password"
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
                <PasswordStrength password={password} />
              </div>

              {/* Confirm Password */}
              <PasswordInput
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: "" });
                }}
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
                disabled={isLoading}
                required
              />

              {/* Terms */}
              <p className="text-[12.5px] text-[#6B6B67] leading-relaxed pt-1">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-[#171717] transition-colors">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline hover:text-[#171717] transition-colors">
                  Privacy Policy
                </Link>
                .
              </p>

              {/* Primary Submit Button */}
              <div className="pt-2">
                <PrimaryButton
                  type="submit"
                  isLoading={isLoading}
                  loadingText="Creating account..."
                >
                  Create account
                </PrimaryButton>
              </div>
            </form>

            {/* Divider */}
            <AuthDivider />

            {/* Social Auth */}
            <SocialButton onClick={handleGoogleSignup} isLoading={socialLoading} />

            {/* Bottom Switcher */}
            <div className="pt-2 text-center text-[14px] text-[#6B6B67]">
              Already have an account?{" "}
              <Link
                href={`/login${nextUrl !== "/" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
                className="font-semibold text-[#171717] hover:text-[#0B5D45] hover:underline transition-colors"
              >
                Log in
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF8]" />}>
      <RegisterForm />
    </Suspense>
  );
}
