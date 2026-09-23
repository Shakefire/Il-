"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  Bell,
  Heart,
  User,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);

  const isSearchActive = pathname === "/search";
  const isHomeActive = pathname === "/";
  const isAboutActive = pathname === "/about";
  const isMessagesActive = pathname === "/messages";

  const isAuthPage = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);

  if (isAuthPage) return null;

  return (
    <header className="sticky top-0 z-50 bg-[#1A1A1A] border-b border-[#2A2A2A] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-2xl sm:text-3xl tracking-tight text-white font-normal">
            Ilé
          </span>
          <span className="w-2 h-2 rounded-full bg-[#0B5D45] mt-1 group-hover:scale-125 transition-transform" />
        </Link>

        {/* Main Nav (Center) - High Readability */}
        <nav className="hidden md:flex items-center space-x-10 text-[15px] font-medium text-[#DCDCDA]">
          <Link
            href="/"
            className={`transition-colors py-2 relative hover:text-white ${
              isHomeActive ? "text-white font-semibold" : ""
            }`}
          >
            <span>Home</span>
            {isHomeActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </Link>

          <Link
            href="/search"
            className={`transition-colors py-2 relative hover:text-white ${
              isSearchActive ? "text-white font-semibold" : ""
            }`}
          >
            <span>Search</span>
            {isSearchActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </Link>

          <Link
            href="/about"
            className={`transition-colors py-2 relative hover:text-white ${
              isAboutActive ? "text-white font-semibold" : ""
            }`}
          >
            <span>About Us</span>
            {isAboutActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </Link>

          <Link
            href="/messages"
            className={`transition-colors py-2 relative hover:text-white flex items-center gap-2 ${
              isMessagesActive ? "text-white font-semibold" : ""
            }`}
          >
            <span>Messages</span>
            <span className="w-2 h-2 rounded-full bg-[#0B5D45]" />
            {isMessagesActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </Link>
        </nav>

        {/* Top Right Utilities & Auth Actions */}
        <div className="hidden lg:flex items-center space-x-6 text-[14px]">
          {/* Utility Icons (Bell & Heart) */}
          <div className="flex items-center space-x-2 text-white/85 border-r border-[#333333] pr-5">
            {/* Bell (Notifications) */}
            <button
              type="button"
              className="p-2 rounded-lg hover:text-white hover:bg-white/10 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell size={19} className="text-white/90 hover:text-white" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0B5D45]" />
            </button>

            {/* Heart (Saved/Favorites) */}
            <button
              type="button"
              onClick={() => setFavCount((c) => (c === 0 ? 1 : 0))}
              className="p-2 rounded-lg hover:text-white hover:bg-white/10 transition-colors relative"
              aria-label="Saved favorites"
            >
              <Heart
                size={19}
                className={favCount > 0 ? "fill-[#0B5D45] text-[#0B5D45]" : "text-white/90 hover:text-white"}
              />
            </button>
          </div>

          {/* Auth Actions */}
          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="text-white hover:text-white/80 transition-colors font-medium px-3 py-1.5 text-[15px]"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B5D45] hover:bg-[#084936] text-white transition-all font-semibold text-[14px] shadow-sm"
            >
              <User size={15} />
              <span>Sign Up</span>
            </Link>
          </div>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="lg:hidden flex items-center space-x-3">
          <Link
            href="/register"
            className="p-2 text-white/90 hover:text-white"
            aria-label="Profile"
          >
            <User size={20} />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-white hover:text-white/80 focus:outline-none"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#1A1A1A] border-b border-[#2A2A2A] px-6 py-6 space-y-4 text-[16px]">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-white font-medium hover:text-[#0B5D45]"
          >
            Home
          </Link>
          <Link
            href="/search"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-white font-medium flex items-center justify-between"
          >
            <span>Search</span>
            <span className="text-xs bg-[#0B5D45] text-white px-2 py-0.5 rounded font-semibold">
              Browse Stays
            </span>
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-white/90 hover:text-white"
          >
            About Us
          </Link>
          <Link
            href="/messages"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-white/90 hover:text-white flex items-center justify-between"
          >
            <span>Messages</span>
            <span className="text-xs bg-[#242424] border border-[#333333] text-[#0B5D45] px-2 py-0.5 rounded font-medium">
              Coming soon
            </span>
          </Link>
          <Link
            href="/host"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-white/90 hover:text-white"
          >
            Become a host
          </Link>

          <div className="pt-4 border-t border-[#2E2E2E] flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-white border border-[#333333] rounded-lg bg-[#242424] font-medium"
            >
              Log In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-white bg-[#0B5D45] hover:bg-[#084936] rounded-lg flex items-center justify-center gap-2 font-semibold"
            >
              <User size={16} />
              <span>Sign Up</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
