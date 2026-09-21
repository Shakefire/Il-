"use client";

import { useState } from "react";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import FormAlert from "@/components/auth/FormAlert";
import { authApi } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setEmailError(undefined);

    if (!email.trim() || !email.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      await authApi.forgotPassword(email);
      setIsSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to process request. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Forgot your password?"
      supportingText="Enter your email and we'll send you a link to reset it."
      imageAlt="Calm sunlit study in an Abuja residence"
    >
      <div className="space-y-6">
        {isSuccess ? (
          <div className="space-y-6">
            <FormAlert
              type="success"
              message={`We've sent a reset link to ${email}. Check your inbox and spam folder.`}
            />
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full h-[52px] bg-[#24483A] text-white rounded-[11px] font-medium text-[15px] hover:bg-[#1B372C] transition-colors"
              >
                Back to log in
              </Link>
            </div>
          </div>
        ) : (
          <>
            {errorMessage && <FormAlert type="error" message={errorMessage} />}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <AuthInput
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(undefined);
                }}
                autoComplete="email"
                error={emailError}
                disabled={isLoading}
                required
              />

              <div className="pt-2">
                <PrimaryButton
                  type="submit"
                  isLoading={isLoading}
                  loadingText="Sending reset link..."
                >
                  Send reset link
                </PrimaryButton>
              </div>
            </form>

            <div className="pt-2 text-center text-[14px]">
              <Link
                href="/login"
                className="font-medium text-[#6B6B67] hover:text-[#171717] hover:underline transition-colors"
              >
                ← Back to log in
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
