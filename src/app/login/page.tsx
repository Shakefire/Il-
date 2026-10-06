"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import FormAlert from "@/components/auth/FormAlert";
import SocialAuthGrid from "@/components/auth/SocialAuthGrid";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Restore remembered email on initial load if previously saved
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("ile_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

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

  const handleOAuth = (provider: "Google" | "Apple") => {
    setErrorMessage(null);
    setInfoNotice(
      `${provider} Single Sign-On is currently reserved for verified corporate partners. Please sign in using your account email and password.`
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoNotice(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const user = await login({ email: cleanEmail, password });

      // Handle "Remember Me" preference
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("ile_remember_email", cleanEmail);
        } else {
          localStorage.removeItem("ile_remember_email");
        }
      }

      // Role and lifecycle-aware redirection
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
    <div className="min-h-screen bg-background relative flex flex-col justify-between items-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 text-primary overflow-x-hidden selection:bg-[#EDF3F0] selection:text-[#0B5D45]">
      {/* 1. Ambient Background Depth Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Soft upper emerald ambient light */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-[#0B5D45]/[0.035] rounded-full blur-3xl" />
        {/* Soft lower ambient reflection */}
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[580px] h-[320px] bg-[#0B5D45]/[0.025] rounded-full blur-3xl" />
        {/* Delicate architectural matrix pattern */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(#E7E5E0 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* 2. Top Navigation Bar */}
      <header className="w-full max-w-xl flex items-center justify-between mb-4 sm:mb-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-primary-secondary hover:text-primary transition-colors py-1.5 px-2.5 -ml-2 rounded-lg hover:bg-[#F0EFEA]/60 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Return to marketplace</span>
        </Link>

        <span className="text-[11px] font-semibold text-primary-muted uppercase tracking-widest font-sans">
          Partner Portal
        </span>
      </header>

      {/* 3. Floating Centered Card Container */}
      <main className="w-full max-w-xl bg-surface border border-border rounded-2xl sm:rounded-3xl p-7 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)] relative z-10 backdrop-blur-xs">
        {/* Brand Mark */}
        <div className="flex justify-center mb-5">
          <Link href="/" className="inline-flex items-center gap-1.5 group focus:outline-none" aria-label="Ilé Homepage">
            <span className="font-display text-3xl sm:text-[34px] tracking-tight text-primary font-normal">
              Ilé
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B5D45] mt-1 group-hover:scale-125 transition-transform" />
          </Link>
        </div>

        {/* Header Block: Eyebrow Badge, Headline, Sub-headline */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-[#EDF5F2] border border-[#0B5D45]/15 text-[#0B5D45] text-[11px] font-semibold tracking-wider uppercase mb-3">
            <span>PROPERTY PARTNER</span>
            <span className="w-1 h-1 rounded-full bg-[#0B5D45]/60" />
            <span>SECURE ACCESS</span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl text-primary font-normal tracking-tight mb-2">
            Sign in to your account
          </h1>

          <p className="font-sans text-[14px] sm:text-[15px] text-primary-secondary leading-relaxed max-w-md mx-auto">
            Access your property listings, tenant reservation requests, and verified partner dashboard.
          </p>
        </div>

        {/* Dynamic Alerts */}
        <div className="space-y-3 mb-6">
          {errorMessage && <FormAlert type="error" message={errorMessage} />}
          {infoNotice && <FormAlert type="info" message={infoNotice} />}
        </div>

        {/* Social Auth Block */}
        <SocialAuthGrid onSelectProvider={handleOAuth} isLoading={isLoading} />

        {/* Primary Form */}
        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {/* Dual-Sided Field Label: Email */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-email"
                className="block text-[13px] font-semibold text-primary tracking-tight font-sans"
              >
                Email address
              </label>
              <span className="text-[12px] text-primary-muted font-normal font-sans">
                Partner or admin email
              </span>
            </div>

            <div className="relative">
              <input
                id="login-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
                }}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLoading}
                required
                className={`w-full h-[52px] px-4 pr-11 bg-white border rounded-[11px] text-[15px] text-primary placeholder:text-[#9E9E9A] transition-all outline-none font-sans ${
                  fieldErrors.email
                    ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10"
                    : "border-border focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10"
                }`}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-primary-muted">
                <Mail size={18} />
              </div>
            </div>

            {fieldErrors.email && (
              <p className="text-[12.5px] text-[#DC2626] font-medium leading-tight pt-0.5">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Dual-Sided Field Label: Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-[13px] font-semibold text-primary tracking-tight font-sans"
              >
                Password
              </label>
              <span className="text-[12px] text-primary-muted font-normal font-sans">
                Case-sensitive
              </span>
            </div>

            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
                required
                className={`w-full h-[52px] px-4 pr-11 bg-white border rounded-[11px] text-[15px] text-primary placeholder:text-[#9E9E9A] transition-all outline-none font-sans ${
                  fieldErrors.password
                    ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10"
                    : "border-border focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10"
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded-md text-primary-muted hover:text-primary focus:outline-none transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {fieldErrors.password && (
              <p className="text-[12.5px] text-[#DC2626] font-medium leading-tight pt-0.5">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Action Row: Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-[13px] pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-border text-[#0B5D45] focus:ring-[#0B5D45]/20 cursor-pointer accent-[#0B5D45]"
              />
              <span className="text-primary-secondary group-hover:text-primary transition-colors font-medium">
                Remember this device
              </span>
            </label>

            <Link
              href="/forgot-password"
              className="text-[13px] font-medium text-[#0B5D45] hover:text-[#084936] hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Primary CTA Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full h-[52px] bg-[#0B5D45] hover:bg-[#084936] active:bg-[#063829] text-white rounded-[12px] font-medium text-[15px] flex items-center justify-center gap-2 transition-all duration-150 shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0B5D45]/20 font-sans"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white/90" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in to account</span>
                  <ArrowRight
                    size={17}
                    className="text-white/80 group-hover:translate-x-1 group-hover:text-white transition-transform duration-150"
                  />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Bottom Switcher */}
        <div className="mt-7 pt-6 border-t border-border text-center text-[13.5px] text-primary-secondary font-sans">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
            className="font-semibold text-[#0B5D45] hover:text-[#084936] hover:underline transition-colors"
          >
            Become an Ilé Property Partner
          </Link>
        </div>
      </main>

      {/* 4. Sub-footer with platform copyright and legal navigation */}
      <footer className="w-full max-w-xl text-center py-6 text-xs text-primary-muted z-10 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
        <span>© 2026 Ilé Hospitality Ltd. All rights reserved.</span>
        <div className="flex items-center gap-4 text-primary-secondary">
          <Link href="/privacy" className="hover:text-primary hover:underline transition-colors">
            Privacy Policy
          </Link>
          <span className="text-border">•</span>
          <Link href="/terms" className="hover:text-primary hover:underline transition-colors">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
