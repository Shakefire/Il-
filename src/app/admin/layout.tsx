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
    <div className="min-h-screen bg-background text-primary antialiased selection:bg-accent-light selection:text-accent">
      {children}
    </div>
  );
}
