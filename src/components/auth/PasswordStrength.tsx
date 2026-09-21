"use client";

interface PasswordStrengthProps {
  password?: string;
}

export default function PasswordStrength({ password = "" }: PasswordStrengthProps) {
  if (!password) return null;

  // Simple calculation: length >= 8, has number, has mixed case/special
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecialOrUpper = /[A-Z!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  let score = 0;
  if (password.length >= 6) score = 1;
  if (hasMinLength) score = 2;
  if (hasMinLength && hasNumber) score = 3;
  if (hasMinLength && hasNumber && hasSpecialOrUpper) score = 4;

  const scoreLabels = ["Too weak", "Weak", "Fair", "Strong", "Very strong"];
  const scoreColors = [
    "bg-[#E7E5E0]",
    "bg-[#DC2626]",
    "bg-[#D97706]",
    "bg-[#0B5D45]",
    "bg-[#0B5D45]",
  ];

  return (
    <div className="pt-1.5 space-y-1.5 animate-in fade-in duration-150">
      <div className="flex items-center justify-between text-[11.5px] text-[#6B6B67]">
        <span>Password strength</span>
        <span className="font-medium text-[#171717]">{scoreLabels[score]}</span>
      </div>

      {/* 4 subtle bars */}
      <div className="grid grid-cols-4 gap-1.5 h-1">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`rounded-full transition-colors duration-200 ${
              score >= step ? scoreColors[score] : "bg-[#E7E5E0]"
            }`}
          />
        ))}
      </div>

      {/* Natural hints */}
      <div className="flex items-center gap-3 text-[11.5px] text-[#8B8B86] pt-0.5">
        <span className={hasMinLength ? "text-[#0B5D45] font-medium" : ""}>
          {hasMinLength ? "✓" : "○"} 8+ characters
        </span>
        <span className={hasNumber ? "text-[#0B5D45] font-medium" : ""}>
          {hasNumber ? "✓" : "○"} One number
        </span>
      </div>
    </div>
  );
}
