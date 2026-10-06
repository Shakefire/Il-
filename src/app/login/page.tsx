"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import FormAlert from "@/components/auth/FormAlert";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Please enter your email address.";
    } else if (!email.includes("@") || !email.includes(".")) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Please enter your password.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const user = await login({ email: email.trim().toLowerCase(), password });

      // Determine redirect path
      if (nextUrl) {
        router.push(nextUrl);
      } else if (user.role === "admin") {
        router.push("/admin");
      } else if (user.role === "host") {
        try {
          const statusRes = await api.getHostOnboardingStatus();
          const vStatus = statusRes?.verificationStatus;
          if (vStatus === "APPROVED" || vStatus === "UNDER_REVIEW") {
            router.push("/host/dashboard");
          } else {
            router.push("/host/onboarding");
          }
        } catch {
          router.push("/host/dashboard");
        }
      } else {
        router.push("/profile");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "We couldn't sign you in with those details. Please check your credentials.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Welcome back."
      supportingText="Log in to your Ilé partner account to manage your listings and bookings."
      imageAlt="Earthy minimalist Nigerian interior with natural light"
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {errorMessage && <FormAlert type="error" message={errorMessage} />}

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {/* Email */}
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

          {/* Password */}
          <div>
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
              }}
              autoComplete="current-password"
              error={fieldErrors.password}
              disabled={isLoading}
              required
            />

            {/* Forgot password link */}
            <div className="flex justify-end pt-1.5">
              <Link
                href="/forgot-password"
                className="text-[13px] text-[#6B6B67] hover:text-[#0B5D45] hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Primary Submit Button */}
          <div className="pt-2">
            <PrimaryButton
              type="submit"
              isLoading={isLoading}
              loadingText="Signing in..."
            >
              Log in →
            </PrimaryButton>
          </div>
        </form>

        {/* Bottom Switcher */}
        <div className="pt-4 border-t border-[#E7E5E0] text-center text-[14px] text-[#6B6B67]">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
            className="font-semibold text-[#0B5D45] hover:underline transition-colors"
          >
            Become an Ilé Property Partner
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF8]" />}>
      <LoginForm />
    </Suspense>
  );
}
