"use client";

interface SocialAuthGridProps {
  onSelectProvider?: (provider: "Google" | "Apple") => void;
  isLoading?: boolean;
  dividerText?: string;
}

export default function SocialAuthGrid({
  onSelectProvider,
  isLoading = false,
  dividerText = "or continue with email",
}: SocialAuthGridProps) {
  return (
    <div className="w-full">
      {/* Equal-width multi-column OAuth button grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Google OAuth Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onSelectProvider?.("Google")}
          className="w-full h-[48px] bg-white hover:bg-[#F9F9F7] active:bg-[#F0EFEB] text-[#171717] border border-[#E7E5E0] hover:border-[#D1CEC7] rounded-[11px] font-medium text-[13.5px] flex items-center justify-center gap-2.5 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0B5D45]/10"
          aria-label="Continue with Google"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z"
              fill="#4285F4"
            />
            <path
              d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
              fill="#34A853"
            />
            <path
              d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z"
              fill="#EA4335"
            />
          </svg>
          <span className="font-sans font-medium text-[#171717]">Google</span>
        </button>

        {/* Apple OAuth Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onSelectProvider?.("Apple")}
          className="w-full h-[48px] bg-white hover:bg-[#F9F9F7] active:bg-[#F0EFEB] text-[#171717] border border-[#E7E5E0] hover:border-[#D1CEC7] rounded-[11px] font-medium text-[13.5px] flex items-center justify-center gap-2.5 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0B5D45]/10"
          aria-label="Continue with Apple"
        >
          <svg width="17" height="17" viewBox="0 0 170 170" fill="currentColor" className="text-[#171717]">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-5.88-8.91-10.45-18.77-13.7-29.58-3.25-10.82-4.88-21.39-4.88-31.72 0-14.35 3.54-26.33 10.63-35.95 7.08-9.61 15.93-14.53 26.54-14.75 4.57 0 9.78 1.25 15.63 3.75 5.85 2.5 9.87 3.81 12.06 3.93 1.74 0 5.86-1.39 12.35-4.17 6.49-2.77 12.01-3.99 16.57-3.67 15.42 1.09 27.24 6.78 35.48 17.07-13.47 8.15-20.09 19.34-19.86 33.56.22 11.3 4.4 20.75 12.56 28.34 3.91 3.7 8.36 6.52 13.36 8.48-2.61 7.6-5.76 15.43-9.44 23.51zM119.22 31.95c0-7.39 2.66-14.44 7.99-21.14 5.33-6.7 11.95-10.81 19.87-12.33.22 1.3.33 2.5.33 3.59 0 7.39-2.82 14.54-8.47 21.46-5.65 6.92-12.38 10.96-20.19 12.12-.22-1.09-.33-2.18-.33-3.7z" />
          </svg>
          <span className="font-sans font-medium text-[#171717]">Apple</span>
        </button>
      </div>

      {/* Subtle horizontal divider with centered text */}
      <div className="relative my-6 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E7E5E0]" />
        </div>
        <span className="relative px-3.5 bg-white text-[11px] sm:text-[12px] font-medium text-[#8B8B86] uppercase tracking-wider font-sans">
          {dividerText}
        </span>
      </div>
    </div>
  );
}
