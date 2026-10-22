"use client";

import { forwardRef } from "react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  contextHint?: React.ReactNode;
  error?: string;
  rightElement?: React.ReactNode;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, contextHint, error, rightElement, id, className = "", ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={inputId}
            className="block text-[13px] font-medium text-[#111827] tracking-normal font-sans"
          >
            {label}
          </label>
          {contextHint && (
            <span className="text-[12px] text-[#4B5563] font-normal font-sans">
              {contextHint}
            </span>
          )}
        </div>
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            className={`w-full h-11 px-3.5 bg-white border rounded-lg text-sm text-[#111827] placeholder:text-[#9CA3AF] placeholder:font-normal transition-[border-color,box-shadow,background-color] duration-150 ease-out outline-none font-sans ${
              error
                ? "border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                : "border-[#D1D5DB] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
            } ${rightElement ? "pr-10" : ""} ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-[#9CA3AF]">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="text-[12px] text-rose-600 font-medium leading-tight pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";

export default AuthInput;
