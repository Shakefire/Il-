"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";

interface FormAlertProps {
  type: "error" | "success";
  message: string;
}

export default function FormAlert({ type, message }: FormAlertProps) {
  if (!message) return null;

  const isSuccess = type === "success";

  return (
    <div
      className={`p-4 rounded-[11px] border text-[14px] flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-150 ${
        isSuccess
          ? "bg-[#EDF3F0] border-[#24483A]/20 text-[#24483A]"
          : "bg-[#FEF2F2] border-[#FCA5A5]/40 text-[#991B1B]"
      }`}
      role="alert"
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      </div>
      <p className="leading-snug">{message}</p>
    </div>
  );
}
