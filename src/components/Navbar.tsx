"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Menu,
  X,
  Bell,
  Heart,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Building2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isHomeActive = pathname === "/";
  const isSearchActive = pathname === "/search";

  const isAuthPage =
    [
      "/login",
      "/register",
      "/signup",
      "/forgot-password",
      "/reset-password",
    ].includes(pathname) ||
    pathname?.startsWith("/host/onboarding") ||
    pathname?.startsWith("/admin");

  if (isAuthPage) return null;

  const isAdmin = user?.role === "admin";
  const isHost = user?.role === "host";

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1A1A1A] border-b border-[#2A2A2A] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        {/* Brand Logo - Routes to /host/dashboard for host, /admin for admin, / for marketplace */}
        <Link
          href={isAdmin ? "/admin" : isHost ? "/host/dashboard" : "/"}
          className="flex items-center gap-2 group"
        >
          <span className="font-display text-2xl sm:text-3xl tracking-tight text-white font-normal">
            Ilé
          </span>
          <span className="w-2 h-2 rounded-full bg-[#0B5D45] mt-1 group-hover:scale-125 transition-transform" />
        </Link>

        {/* Main Nav (Center) */}
        <nav className="hidden md:flex items-center space-x-10 text-[15px] font-medium text-[#DCDCDA]">
          {isAdmin ? (
            /* Admin Workspace Navigation */
            <Link
              href="/admin"
              className={`transition-colors py-2 relative hover:text-white flex items-center gap-1.5 text-amber-400 ${
                pathname?.startsWith("/admin") ? "font-semibold" : ""
              }`}
            >
              <ShieldCheck size={16} />
              <span>Admin Dashboard</span>
              {pathname?.startsWith("/admin") && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-400 rounded-full" />
              )}
            </Link>
          ) : isHost ? (
            /* Host Workspace Navigation */
            <>
              <Link
                href="/host/dashboard"
                className={`transition-colors py-2 relative hover:text-white ${
                  pathname === "/host/dashboard" ? "text-white font-semibold" : ""
                }`}
              >
                <span>Host Dashboard</span>
                {pathname === "/host/dashboard" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0B5D45] rounded-full" />
                )}
              </Link>
              <Link
                href="/become-a-host"
                className={`transition-colors py-2 relative hover:text-white ${
                  pathname === "/become-a-host" ? "text-white font-semibold" : ""
                }`}
              >
                <span>List Property</span>
                {pathname === "/become-a-host" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0B5D45] rounded-full" />
                )}
              </Link>
            </>
          ) : (
            /* Marketplace Public Navigation */
            <>
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
                <span>Explore</span>
                {isSearchActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
                )}
              </Link>

              {/* Partner link routes directly to Host Account Creation page, NOT admin login */}
              <Link
                href="/signup"
                className="transition-colors py-2 relative hover:text-white text-[#EDF5F2]"
              >
                <span>Partner as Host</span>
              </Link>
            </>
          )}
        </nav>

        {/* Top Right Utilities & Auth Actions */}
        <div className="hidden lg:flex items-center space-x-5 text-[14px]">
          {/* Marketplace Utility Icons (Notifications & Saved Favorites) */}
          <div className="flex items-center space-x-2 text-white/85 border-r border-[#333333] pr-4">
            <button
              type="button"
              className="p-2 rounded-lg hover:text-white hover:bg-white/10 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-white/90 hover:text-white" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0B5D45]" />
            </button>

            <button
              type="button"
              onClick={() => setFavCount((c) => (c === 0 ? 1 : 0))}
              className="p-2 rounded-lg hover:text-white hover:bg-white/10 transition-colors relative"
              aria-label="Saved favorites"
            >
              <Heart
                size={18}
                className={favCount > 0 ? "fill-[#0B5D45] text-[#0B5D45]" : "text-white/90 hover:text-white"}
              />
            </button>
          </div>

          {/* Dynamic Auth Actions / User Menu */}
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#0B5D45] text-white flex items-center justify-center font-semibold text-sm">
                  {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </div>
                <span className="font-medium text-[14px]">
                  {user.firstName ? `${user.firstName}` : user.email.split("@")[0]}
                </span>
                <ChevronDown size={14} className="text-white/70" />
              </button>

              {/* Profile Dropdown */}
              <AnimatePresence>
                {profileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-0 mt-2 w-60 bg-[#222222] border border-[#333333] rounded-2xl shadow-2xl py-2 z-50 text-sm overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-[#333333]">
                      <p className="font-semibold text-white">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-[#8B8B86] truncate max-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis block mt-0.5">
                        {user.email}
                      </p>
                      <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-[#0B5D45]/30 text-[#8CE3C3] uppercase tracking-wider">
                        {user.role}
                      </span>
                    </div>

                    {isAdmin ? (
                      <Link
                        href="/admin"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-amber-400 hover:text-amber-300 hover:bg-white/5 transition-colors font-medium"
                      >
                        <ShieldCheck size={16} />
                        <span>Admin Dashboard</span>
                      </Link>
                    ) : (
                      <>
                        <Link
                          href="/host/dashboard"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-white/90 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                          <Building2 size={16} className="text-[#0B5D45]" />
                          <span>Host Dashboard</span>
                        </Link>
                        <Link
                          href="/become-a-host"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-white/90 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                          <Building2 size={16} />
                          <span>List Property</span>
                        </Link>
                      </>
                    )}

                    <div className="border-t border-[#333333] pt-1 mt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={16} />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors font-medium text-[14px]"
              >
                Log In
              </Link>
              {/* Host account creation page */}
              <Link
                href="/signup"
                className="px-5 py-2.5 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white font-semibold transition-all shadow-sm hover:shadow text-[14px] flex items-center gap-2"
              >
                <Building2 size={16} />
                <span>Partner Sign Up</span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-white/80 hover:text-white focus:outline-none"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#1A1A1A] border-b border-[#2E2E2E] px-6 py-6 space-y-4">
          {isAdmin ? (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-amber-400 font-semibold text-lg"
            >
              Admin Dashboard
            </Link>
          ) : isHost ? (
            <>
              <Link
                href="/host/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-white font-medium text-lg hover:text-[#0B5D45]"
              >
                Host Dashboard
              </Link>
              <Link
                href="/become-a-host"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-white font-medium text-lg hover:text-[#0B5D45]"
              >
                List Property
              </Link>
            </>
          ) : (
            <>
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
                <span>Explore Stays</span>
                <span className="text-xs bg-[#0B5D45] text-white px-2 py-0.5 rounded font-semibold">
                  Browse
                </span>
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-white/90 hover:text-white"
              >
                Partner as Host
              </Link>
            </>
          )}

          <div className="pt-4 border-t border-[#2E2E2E] flex flex-col gap-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 text-center text-red-400 border border-red-500/20 rounded-lg bg-red-500/10 font-medium cursor-pointer"
              >
                Log Out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-white border border-[#333333] rounded-lg bg-[#242424] font-medium"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-white bg-[#0B5D45] hover:bg-[#084936] rounded-lg flex items-center justify-center gap-2 font-semibold"
                >
                  <Building2 size={16} />
                  <span>Partner Sign Up</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
