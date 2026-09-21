"use client";

import { Loader2 } from "lucide-react";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export default function PrimaryButton({
  isLoading = false,
  loadingText,
  children,
  className = "",
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      disabled={isLoading || disabled}
      className={`w-full h-[52px] sm:h-[54px] bg-[#24483A] hover:bg-[#1B372C] active:bg-[#152B22] text-white rounded-[11px] font-medium text-[15px] flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 size={18} className="animate-spin text-white/80" />
          <span>{loadingText || "Please wait..."}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
