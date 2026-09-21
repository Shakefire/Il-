"use client";

import { forwardRef } from "react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, rightElement, id, className = "", ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-[13px] font-semibold text-[#171717] tracking-tight"
        >
          {label}
        </label>
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            className={`w-full h-[54px] px-4 bg-white border rounded-[11px] text-[15px] text-[#171717] placeholder:text-[#9E9E9A] transition-all outline-none ${
              error
                ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10"
                : "border-[#E7E5E0] focus:border-[#24483A] focus:ring-2 focus:ring-[#24483A]/10"
            } ${rightElement ? "pr-12" : ""} ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-[#6B6B67]">
              {rightElement}
            </div>
          )}
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

AuthInput.displayName = "AuthInput";

export default AuthInput;
