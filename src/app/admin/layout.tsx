import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ilé — Administrative Compliance & Operations Workspace",
  description: "Secure, isolated compliance and oversight portal for Ilé Hospitality administrators.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717] selection:bg-[#EDF3F0] selection:text-[#0B5D45] antialiased">
      {children}
    </div>
  );
}
