"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import PhoneInput from "@/components/auth/PhoneInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import SocialButton from "@/components/auth/SocialButton";
import AuthDivider from "@/components/auth/AuthDivider";
import FormAlert from "@/components/auth/FormAlert";
import { authApi } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

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

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      await authApi.register({
        firstName,
        lastName,
        email,
        phone: `+234${phone.replace(/^0+/, "")}`,
        password,
      });

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 1500);
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
      router.push("/");
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
              message="Account created. You're ready to start exploring."
            />
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center w-full h-[52px] bg-[#24483A] text-white rounded-[11px] font-medium text-[15px]"
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
                  placeholder="Kabir"
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
                  placeholder="Hassan"
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
                placeholder="your@email.com"
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
                  placeholder="Create a password"
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
                href="/login"
                className="font-semibold text-[#171717] hover:text-[#24483A] hover:underline transition-colors"
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
