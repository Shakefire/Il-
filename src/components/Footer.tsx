"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Lock,
  Mail,
  Phone,
  MessageCircle,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  ChevronDown,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { usePathname } from "next/navigation";

// ─── Newsletter Section ────────────────────────────────────────────────────────

function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isAlready, setIsAlready] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function reset() {
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  }

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setIsAlready(false);

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setMessage(data.message);
      setIsAlready(!!data.alreadySubscribed);
      if (!data.alreadySubscribed) setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  }

  return (
    <div className="border-b border-[#242424] pb-10 mb-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center">
        <div>
          <h3 className="font-display text-xl sm:text-2xl text-white font-normal tracking-tight">
            Stay Inspired. Stay Connected.
          </h3>
          <p className="mt-1.5 text-[14px] text-[#9E9E9A] leading-relaxed">
            Discover exceptional stays, exclusive offers and hospitality updates from Ilé.
          </p>
        </div>

        <form onSubmit={handleSubscribe} noValidate aria-label="Newsletter subscription">
          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); reset(); }}
              placeholder="Enter your email address"
              disabled={status === "loading"}
              autoComplete="email"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-[#1E1E1E] border border-[#2E2E2E] text-white placeholder-[#6B6B67] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45] focus:border-transparent transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "loading" || status === "success"}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14px] font-semibold transition-all disabled:opacity-60 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D45] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]"
            >
              {status === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : status === "success" ? (
                "Subscribed ✓"
              ) : (
                <>
                  Subscribe <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-2.5 text-[13px] ${
                status === "success"
                  ? isAlready
                    ? "text-[#9E9E9A]"
                    : "text-[#4CAF82]"
                  : "text-[#E57373]"
              }`}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Collapsible Mobile Column ─────────────────────────────────────────────────

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center justify-between py-3 md:py-0 md:cursor-default focus:outline-none focus-visible:underline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          {title}
        </span>
        <ChevronDown
          size={14}
          className={`md:hidden text-[#6B6B67] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Desktop: always visible. Mobile: collapsible. */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out md:!max-h-none md:!overflow-visible ${
          open ? "max-h-72" : "max-h-0 md:max-h-none"
        }`}
      >
        <ul className="space-y-2.5 pt-2 md:pt-3 pb-2 md:pb-0">{children}</ul>
      </div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[13.5px] text-[#8F8F8B] hover:text-white transition-colors focus:outline-none focus-visible:underline focus-visible:text-white"
      >
        {children}
      </Link>
    </li>
  );
}

// ─── Social icons config ───────────────────────────────────────────────────────

const SOCIALS = [
  { icon: Instagram, label: "Instagram" },
  { icon: Twitter, label: "X (Twitter)" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: Facebook, label: "Facebook" },
] as const;

// ─── Main Footer ───────────────────────────────────────────────────────────────

export default function Footer() {
  const pathname = usePathname();

  const isHidden =
    ["/login", "/register", "/signup", "/forgot-password", "/reset-password"].includes(
      pathname ?? ""
    ) ||
    pathname?.startsWith("/host/onboarding") ||
    pathname?.startsWith("/admin");

  if (isHidden) return null;

  return (
    <footer className="bg-[#141414] border-t border-[#1E1E1E] text-[#8F8F8B]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-14 pb-6">

        {/* Newsletter */}
        <NewsletterSection />

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 pb-10 border-b border-[#242424]">

          {/* ── Brand Column ── */}
          <div className="md:col-span-4 flex flex-col gap-5 pb-8 md:pb-0 border-b border-[#1E1E1E] md:border-0 mb-2 md:mb-0">
            <Link href="/" className="inline-flex items-center gap-2" aria-label="Ilé — Home">
              <span className="font-display text-[22px] tracking-tight text-white font-normal leading-none">
                Ilé
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B5D45]" />
            </Link>

            <p className="text-[13.5px] leading-relaxed text-[#9E9E9A] max-w-xs">
              Thoughtfully curated accommodations across Abuja and Lagos. Every stay is
              verified in person for continuous power, high-speed fiber internet, and gated
              perimeter security.
            </p>

            {/* Trust badges */}
            <div className="flex flex-col gap-2 text-[12px] text-[#8A8A85]">
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-[#0B5D45] flex-shrink-0" />
                <span>24/7 Power Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={12} className="text-[#0B5D45] flex-shrink-0" />
                <span>In-Person Vetted</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock size={12} className="text-[#0B5D45] flex-shrink-0" />
                <span>Secure Payments</span>
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-2 text-[13px]">
              <a
                href="mailto:info@ilestays.ng"
                className="flex items-center gap-2 text-[#8F8F8B] hover:text-white transition-colors focus:outline-none focus-visible:underline"
              >
                <Mail size={13} className="text-[#0B5D45] flex-shrink-0" />
                info@ilestays.ng
              </a>
              <a
                href="tel:+2340912202904"
                className="flex items-center gap-2 text-[#8F8F8B] hover:text-white transition-colors focus:outline-none focus-visible:underline"
              >
                <Phone size={13} className="text-[#0B5D45] flex-shrink-0" />
                0912 202 904
              </a>
              <a
                href="https://wa.me/2340912202904"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#8F8F8B] hover:text-white transition-colors focus:outline-none focus-visible:underline"
              >
                <MessageCircle size={13} className="text-[#0B5D45] flex-shrink-0" />
                WhatsApp Us
              </a>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-2.5">
              {SOCIALS.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-[#1E1E1E] hover:bg-[#0B5D45] flex items-center justify-center text-[#8F8F8B] hover:text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D45] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* ── Nav columns (8 cols) ── */}
          <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-4 gap-0 md:gap-8 divide-y divide-[#1E1E1E] md:divide-y-0 pt-2 md:pt-0">

            {/* Discover */}
            <FooterColumn title="Discover">
              <FooterLink href="/search">Find a Stay</FooterLink>
              <FooterLink href="/about#how-it-works">How It Works</FooterLink>
              <FooterLink href="/trips">My Bookings</FooterLink>
              <FooterLink href="/about#contact">Guest Support</FooterLink>
              <FooterLink href="/search">Popular Destinations</FooterLink>
            </FooterColumn>

            {/* For Hosts */}
            <FooterColumn title="For Hosts">
              <FooterLink href="/become-a-host">Become a Host</FooterLink>
              <FooterLink href="/login">Host Login</FooterLink>
              <FooterLink href="/host/dashboard">Host Dashboard</FooterLink>
              <FooterLink href="/become-a-host">List Your Property</FooterLink>
              <FooterLink href="/about#standards">Hosting Standards</FooterLink>
            </FooterColumn>

            {/* Company */}
            <FooterColumn title="Company">
              <FooterLink href="/about">About Ilé</FooterLink>
              <FooterLink href="/about#standards">Infrastructure Standards</FooterLink>
              <FooterLink href="/about#contact">Contact Us</FooterLink>
              <FooterLink href="/about#contact">Concierge &amp; Support</FooterLink>
            </FooterColumn>

            {/* Legal */}
            <FooterColumn title="Legal">
              <FooterLink href="/terms">Terms of Service</FooterLink>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/terms#guest-guarantee">Guest Guarantee</FooterLink>
              <FooterLink href="/terms#cancellations">Cancellation Policy</FooterLink>
              <FooterLink href="/sitemap.xml">Sitemap</FooterLink>
            </FooterColumn>

          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#5A5A56]">
          <p>© 2026 Ilé Hospitality Ltd. Abuja · Lagos, Nigeria.</p>
          <div className="flex items-center gap-1.5 text-[#6B6B67]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B5D45] flex-shrink-0" aria-hidden="true" />
            <span>Verified Hospitality Network</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
