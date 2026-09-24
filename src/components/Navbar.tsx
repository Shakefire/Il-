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
  Calendar,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

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

  const isSearchActive = pathname === "/search";
  const isHomeActive = pathname === "/";
  const isTripsActive = pathname === "/trips";
  const isHostActive = pathname?.startsWith("/host") || pathname === "/become-a-host";

  const isAuthPage = [
    "/login",
    "/register",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);

  if (isAuthPage) return null;

  const isHost = user?.role === "host";
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    router.push("/");
  };

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

        {/* Main Nav (Center) - Dynamic based on Auth Role */}
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
            <span>Explore</span>
            {isSearchActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </Link>

          {/* Trips - Only for authenticated users */}
          {isAuthenticated && (
            <Link
              href="/trips"
              className={`transition-colors py-2 relative hover:text-white ${
                isTripsActive ? "text-white font-semibold" : ""
              }`}
            >
              <span>Trips</span>
              {isTripsActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
              )}
            </Link>
          )}

          {/* Host Portal / Become a host */}
          {isHost ? (
            <Link
              href="/host/dashboard"
              className={`transition-colors py-2 relative hover:text-white ${
                isHostActive ? "text-white font-semibold" : ""
              }`}
            >
              <span>Host Dashboard</span>
              {isHostActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
              )}
            </Link>
          ) : (
            <Link
              href={isAuthenticated ? "/become-a-host" : "/login?next=/become-a-host"}
              className={`transition-colors py-2 relative hover:text-white ${
                isHostActive ? "text-white font-semibold" : ""
              }`}
            >
              <span>Become a Host</span>
              {isHostActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
              )}
            </Link>
          )}

          {/* Admin link - STRICTLY ONLY for verified admin users */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`transition-colors py-2 relative hover:text-white flex items-center gap-1.5 text-amber-400 ${
                pathname?.startsWith("/admin") ? "font-semibold" : ""
              }`}
            >
              <ShieldCheck size={16} />
              <span>Admin Portal</span>
              {pathname?.startsWith("/admin") && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-400 rounded-full" />
              )}
            </Link>
          )}
        </nav>

        {/* Top Right Utilities & Auth Actions */}
        <div className="hidden lg:flex items-center space-x-6 text-[14px]">
          {/* Utility Icons (Bell & Heart) */}
          <div className="flex items-center space-x-2 text-white/85 border-r border-[#333333] pr-5">
            <button
              type="button"
              className="p-2 rounded-lg hover:text-white hover:bg-white/10 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell size={19} className="text-white/90 hover:text-white" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0B5D45]" />
            </button>

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

          {/* Dynamic Auth Actions / User Menu */}
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
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
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#222222] border border-[#333333] rounded-xl shadow-xl py-2 z-50 text-sm">
                  <div className="px-4 py-2 border-b border-[#333333]">
                    <p className="font-semibold text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-[#8B8B86] truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded bg-[#0B5D45]/30 text-[#8CE3C3] uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-white/90 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <UserIcon size={16} />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    href="/trips"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-white/90 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Calendar size={16} />
                    <span>My Trips</span>
                  </Link>

                  {isHost ? (
                    <Link
                      href="/host/dashboard"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-white/90 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Building2 size={16} />
                      <span>Host Dashboard</span>
                    </Link>
                  ) : (
                    <Link
                      href="/become-a-host"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-white/90 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Building2 size={16} />
                      <span>Become a Host</span>
                    </Link>
                  )}

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-amber-400 hover:text-amber-300 hover:bg-white/5 transition-colors border-t border-[#333333]"
                    >
                      <ShieldCheck size={16} />
                      <span>Admin Management</span>
                    </Link>
                  )}

                  <div className="border-t border-[#333333] pt-1 mt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut size={16} />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                href="/login"
                className="text-white hover:text-white/80 transition-colors font-medium px-3 py-1.5 text-[15px]"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B5D45] hover:bg-[#084936] text-white transition-all font-semibold text-[14px] shadow-sm"
              >
                <UserIcon size={15} />
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Trigger */}
        <div className="lg:hidden flex items-center space-x-3">
          {isAuthenticated ? (
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full bg-[#0B5D45] text-white flex items-center justify-center font-semibold text-sm"
              aria-label="Profile"
            >
              {user?.firstName?.[0]?.toUpperCase() || "U"}
            </Link>
          ) : (
            <Link
              href="/signup"
              className="p-2 text-white/90 hover:text-white"
              aria-label="Sign Up"
            >
              <UserIcon size={20} />
            </Link>
          )}

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
            <span>Explore Stays</span>
            <span className="text-xs bg-[#0B5D45] text-white px-2 py-0.5 rounded font-semibold">
              Browse
            </span>
          </Link>

          {isAuthenticated && (
            <Link
              href="/trips"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-white font-medium"
            >
              My Trips
            </Link>
          )}

          {isHost ? (
            <Link
              href="/host/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-white font-medium"
            >
              Host Dashboard
            </Link>
          ) : (
            <Link
              href={isAuthenticated ? "/become-a-host" : "/login?next=/become-a-host"}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-white/90 hover:text-white"
            >
              Become a host
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-amber-400 font-medium"
            >
              Admin Portal
            </Link>
          )}

          <div className="pt-4 border-t border-[#2E2E2E] flex flex-col gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-white border border-[#333333] rounded-lg bg-[#242424] font-medium"
                >
                  My Profile
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 text-center text-red-400 border border-red-500/20 rounded-lg bg-red-500/10 font-medium"
                >
                  Log Out
                </button>
              </>
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
                  <UserIcon size={16} />
                  <span>Sign Up</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
