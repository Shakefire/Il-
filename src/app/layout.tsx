import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ilestays.ng"),
  title: {
    default: "Ilé | Discover Exceptional Shortlet Apartments in Nigeria",
    template: "%s | Ilé",
  },
  description:
    "Discover verified shortlet apartments and exceptional stays in Abuja and Lagos with Ilé. Explore carefully curated accommodation, secure bookings and trusted hospitality.",
  keywords: [
    "Abuja shortlet",
    "Lagos shortlet",
    "Maitama shortlet",
    "Ikoyi stays",
    "Victoria Island serviced apartment",
    "Lekki shortlet",
    "Nigerian hospitality",
    "shortlet apartments Nigeria",
    "verified accommodation Nigeria",
  ],
  authors: [{ name: "Ilé Hospitality Ltd." }],
  creator: "Ilé Hospitality Ltd.",
  publisher: "Ilé Hospitality Ltd.",
  alternates: {
    canonical: "https://ilestays.ng",
  },
  openGraph: {
    title: "Ilé | Discover Exceptional Shortlet Apartments in Nigeria",
    description:
      "Discover verified shortlet apartments and exceptional stays in Abuja and Lagos with Ilé. Carefully curated accommodation with secure bookings.",
    url: "https://ilestays.ng",
    siteName: "Ilé",
    locale: "en_NG",
    type: "website",
    images: [
      {
        url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
        width: 1200,
        height: 630,
        alt: "Ilé — Exceptional Shortlet Stays in Nigeria",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ilé | Discover Exceptional Shortlet Apartments in Nigeria",
    description:
      "Discover verified shortlet apartments and exceptional stays in Abuja and Lagos with Ilé.",
    images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"],
  },
  verification: {
    google: "googled59b53f63f4e67b9",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://ilestays.ng/#organization",
                  name: "Ilé Hospitality Ltd.",
                  url: "https://ilestays.ng",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://ilestays.ng/logo.png",
                  },
                  contactPoint: {
                    "@type": "ContactPoint",
                    telephone: "+2340912202904",
                    contactType: "customer support",
                    email: "info@ilestays.ng",
                    availableLanguage: "English",
                  },
                  sameAs: [],
                },
                {
                  "@type": "WebSite",
                  "@id": "https://ilestays.ng/#website",
                  url: "https://ilestays.ng",
                  name: "Ilé",
                  description:
                    "Discover verified shortlet apartments and exceptional stays in Abuja and Lagos with Ilé.",
                  publisher: {
                    "@id": "https://ilestays.ng/#organization",
                  },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: "https://ilestays.ng/search?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
