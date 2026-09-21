"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import PrimaryButton from "@/components/auth/PrimaryButton";
import FormAlert from "@/components/auth/FormAlert";
import { authApi } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  const validateForm = () => {
    const errors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      errors.password = "Please enter your new password.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      await authApi.resetPassword({ password });
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to reset password. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Reset your password."
      supportingText="Choose a new, secure password for your account."
      imageAlt="Quiet living space in a contemporary Nigerian residence"
    >
      <div className="space-y-6">
        {isSuccess ? (
          <div className="space-y-6">
            <FormAlert
              type="success"
              message="Your password has been reset successfully. Redirecting to log in..."
            />
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full h-[52px] bg-[#24483A] text-white rounded-[11px] font-medium text-[15px] hover:bg-[#1B372C] transition-colors"
              >
                Continue to log in →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {errorMessage && <FormAlert type="error" message={errorMessage} />}

            <form onSubmit={handleReset} className="space-y-4" noValidate>
              <div>
                <PasswordInput
                  label="New Password"
                  placeholder="Create a new password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  autoComplete="new-password"
                  error={fieldErrors.password}
                  disabled={isLoading}
                  required
                />
                <PasswordStrength password={password} />
              </div>

              <div>
                <PasswordInput
                  label="Confirm New Password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                    }
                  }}
                  autoComplete="new-password"
                  error={fieldErrors.confirmPassword}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="pt-2">
                <PrimaryButton
                  type="submit"
                  isLoading={isLoading}
                  loadingText="Resetting password..."
                >
                  Reset password
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
