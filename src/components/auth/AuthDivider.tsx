interface AuthDividerProps {
  text?: string;
}

export default function AuthDivider({ text = "or" }: AuthDividerProps) {
  return (
    <div className="relative my-6 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[#E7E5E0]" />
      </div>
      <span className="relative px-3.5 bg-[#FAFAF8] text-[13px] text-[#8B8B86] font-normal uppercase tracking-wider">
        {text}
      </span>
    </div>
  );
}
