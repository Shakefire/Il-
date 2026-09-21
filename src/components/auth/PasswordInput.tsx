"use client";

import { useState, forwardRef } from "react";
import AuthInput from "./AuthInput";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label = "Password", ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <AuthInput
        label={label}
        ref={ref}
        type={showPassword ? "text" : "password"}
        rightElement={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-1 rounded-md text-[#8B8B86] hover:text-[#171717] focus:outline-none transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
        {...props}
      />
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
