import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ilé — Thoughtfully Selected Stays Across Nigeria",
  description:
    "A calm, curated marketplace for premium shortlets, apartments, and residences in Abuja and Lagos. Verified 24/7 power, fiber internet, and gated security.",
  keywords: [
    "Abuja shortlet",
    "Lagos apartments",
    "Maitama shortlet",
    "Ikoyi stays",
    "Nigerian hospitality",
    "Victoria Island serviced apartment",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#FAFAF8] text-[#171717] antialiased selection:bg-[#EDF3F0] selection:text-[#24483A]">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
