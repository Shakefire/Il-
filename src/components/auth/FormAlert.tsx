"use client";

import { CheckCircle2, AlertCircle, Info } from "lucide-react";

interface FormAlertProps {
  type: "error" | "success" | "info";
  message: string;
}

export default function FormAlert({ type, message }: FormAlertProps) {
  if (!message) return null;

  const isSuccess = type === "success";
  const isInfo = type === "info";

  return (
    <div
      className={`p-4 rounded-[11px] border text-[14px] flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-150 ${
        isSuccess
          ? "bg-[#EDF5F2] border-[#0B5D45]/20 text-[#0B5D45]"
          : isInfo
          ? "bg-[#F4F7F5] border-[#0B5D45]/20 text-[#0B5D45]"
          : "bg-[#FEF2F2] border-[#FCA5A5]/40 text-[#991B1B]"
      }`}
      role="alert"
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess ? (
          <CheckCircle2 size={18} />
        ) : isInfo ? (
          <Info size={18} />
        ) : (
          <AlertCircle size={18} />
        )}
      </div>
      <p className="leading-snug">{message}</p>
    </div>
  );
}
