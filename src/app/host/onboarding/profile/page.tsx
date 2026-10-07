"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { useOnboarding } from "@/context/OnboardingContext";
import { ArrowRight, ArrowLeft } from "lucide-react";

const NIGERIAN_CITIES = [
  "Abuja",
  "Lagos",
  "Port Harcourt",
  "Ibadan",
  "Enugu",
  "Calabar",
  "Kaduna",
  "Benin City",
  "Owerri",
  "Kano",
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function ProfileStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.firstName.trim() || !data.lastName.trim()) {
      setError("Please provide your legal first and last name matching your government ID.");
      return;
    }

    setIsNavigating(true);
    // Ensure data is saved to backend before navigating
    await saveStepData(2).catch(() => null);
    router.push("/host/onboarding/identity");
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mb-2">
          About you &amp; your locations
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Provide your legal identity and the cities where you manage or host accommodations.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <motion.form
        variants={containerVariants}
        initial="hidden"
        animate="show"
        onSubmit={handleContinue}
        className="space-y-6"
      >
        {/* Name Fields (2 cols) */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Legal First Name</label>
            <input
              type="text"
              value={data.firstName}
              onChange={(e) => updateData({ firstName: e.target.value })}
              placeholder="e.g. Chukwuma"
              required
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
            <p className="text-[12px] text-[#8B8B86] mt-1.5">As stated on your official government ID card</p>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Legal Last Name</label>
            <input
              type="text"
              value={data.lastName}
              onChange={(e) => updateData({ lastName: e.target.value })}
              placeholder="e.g. Adeleke"
              required
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
            <p className="text-[12px] text-[#8B8B86] mt-1.5">Family name or surname matching your ID</p>
          </div>
        </motion.div>

        {/* Date of Birth & Residential Address */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Date of Birth</label>
            <input
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => updateData({ dateOfBirth: e.target.value })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
            <p className="text-[12px] text-[#8B8B86] mt-1.5">Hosts must be at least 18 years old</p>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Residential Address</label>
            <input
              type="text"
              value={data.residentialAddress}
              onChange={(e) => updateData({ residentialAddress: e.target.value })}
              placeholder="e.g. 14 Danube Street, Maitama, Abuja"
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
            <p className="text-[12px] text-[#8B8B86] mt-1.5">Current personal residence or registered domicile</p>
          </div>
        </motion.div>

        {/* Operating City & Neighborhoods */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Primary Operating City</label>
            <select
              value={data.operatingCity}
              onChange={(e) => updateData({ operatingCity: e.target.value })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all cursor-pointer"
            >
              {NIGERIAN_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-[#8B8B86] mt-1.5">Primary metropolitan market for your listings</p>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Operating Neighborhoods</label>
            <input
              type="text"
              value={data.operatingAreas}
              onChange={(e) => updateData({ operatingAreas: e.target.value })}
              placeholder="e.g. Maitama, Guzape, Lekki Phase 1"
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
            <p className="text-[12px] text-[#8B8B86] mt-1.5">Specific districts or target hosting zones</p>
          </div>
        </motion.div>

        {/* Short Bio */}
        <motion.div variants={itemVariants}>
          <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">About Your Hosting Practice</label>
          <textarea
            rows={3}
            value={data.bio}
            onChange={(e) => updateData({ bio: e.target.value })}
            placeholder="Introduce yourself or your hospitality brand to potential guests..."
            className="w-full p-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all resize-none"
          />
          <p className="text-[12px] text-[#8B8B86] mt-1.5">Public host biography shown on your verified listing pages</p>
        </motion.div>

        {/* Action Row: Back Link on Left, Standardized Secondary Ghost + Primary Continue on Right */}
        <motion.div
          variants={itemVariants}
          className="pt-6 border-t border-[#E7E5E0] flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <Link
            href="/host/onboarding/business-type"
            className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors order-2 sm:order-1"
          >
            <ArrowLeft size={16} />
            <span>Back to Business Type</span>
          </Link>

          <div className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
            <Link
              href="/host/dashboard"
              className="w-full sm:w-auto h-[48px] sm:h-[50px] px-5 sm:px-6 rounded-xl border border-[#E7E5E0] hover:border-[#D1CEC7] bg-white hover:bg-[#FAFAF8] text-[14px] font-medium text-[#6B6B67] hover:text-[#171717] transition-all flex items-center justify-center"
            >
              Skip to Dashboard
            </Link>

            <button
              type="submit"
              disabled={isNavigating}
              className="w-full sm:w-auto h-[48px] sm:h-[50px] px-7 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
            >
              <span>Continue to Identity KYC</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </motion.form>
    </div>
  );
}
