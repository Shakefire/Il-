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
      className={`w-full h-11 bg-[#065F46] hover:bg-[#044E39] active:bg-[#044E39] text-white rounded-lg font-medium text-[15px] flex items-center justify-center gap-2 transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#065F46]/25 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-xs cursor-pointer ${className}`}
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
