"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import SocialButton from "@/components/auth/SocialButton";
import AuthDivider from "@/components/auth/AuthDivider";
import FormAlert from "@/components/auth/FormAlert";
import { authApi } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
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
      await authApi.login({ email, password });
      router.push("/");
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

  const handleGoogleLogin = async () => {
    setSocialLoading(true);
    setErrorMessage(null);

    try {
      // Simulate OAuth redirect/login
      await new Promise((resolve) => setTimeout(resolve, 600));
      router.push("/");
    } catch {
      setErrorMessage("Unable to connect with Google. Please try again.");
    } finally {
      setSocialLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Welcome back."
      supportingText="Sign in to continue to your stays."
      imageAlt="Warm natural light in a contemporary Maitama residence"
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {errorMessage && <FormAlert type="error" message={errorMessage} />}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {/* Email */}
          <AuthInput
            label="Email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
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
                if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
              }}
              autoComplete="current-password"
              error={fieldErrors.password}
              disabled={isLoading}
              required
            />
            <div className="flex justify-end pt-1.5">
              <Link
                href="/forgot-password"
                className="text-[13px] font-medium text-[#6B6B67] hover:text-[#171717] hover:underline transition-colors"
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
              Log in
            </PrimaryButton>
          </div>
        </form>

        {/* Divider */}
        <AuthDivider />

        {/* Social Auth */}
        <SocialButton onClick={handleGoogleLogin} isLoading={socialLoading} />

        {/* Bottom Switcher */}
        <div className="pt-2 text-center text-[14px] text-[#6B6B67]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#171717] hover:text-[#24483A] hover:underline transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
