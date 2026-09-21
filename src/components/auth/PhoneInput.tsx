"use client";

import { forwardRef } from "react";

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label = "Phone Number", error, id, ...props }, ref) => {
    const inputId = id || "phone-input";

    return (
      <div className="w-full space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-[13px] font-semibold text-[#171717] tracking-tight"
        >
          {label}
        </label>
        <div className="flex rounded-[11px] overflow-hidden border border-[#E7E5E0] focus-within:border-[#24483A] focus-within:ring-2 focus-within:ring-[#24483A]/10 bg-white transition-all">
          {/* Nigerian Country Code Badge */}
          <div className="flex items-center gap-1.5 px-3.5 bg-[#F9F9F7] border-r border-[#E7E5E0] select-none text-[#171717] text-[14px] font-medium shrink-0">
            <span className="text-base" role="img" aria-label="Nigeria flag">
              🇳🇬
            </span>
            <span>+234</span>
          </div>

          <input
            id={inputId}
            ref={ref}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="803 123 4567"
            className="w-full h-[54px] px-3.5 bg-transparent text-[15px] text-[#171717] placeholder:text-[#9E9E9A] outline-none"
            {...props}
          />
        </div>
        {error && (
          <p className="text-[12.5px] text-[#DC2626] font-medium leading-tight">
            {error}
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
