"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Building2,
  LogOut,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?next=/profile");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
      </div>
    );
  }

  const isHost = user.role === "host";
  const isAdmin = user.role === "admin";

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header */}
        <div className="bg-white border border-[#E7E5E0] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-[#0B5D45] text-white flex items-center justify-center font-display text-3xl font-normal shadow-sm">
              {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-[#171717]">
                  {user.firstName ? `${user.firstName} ${user.lastName}` : "User Profile"}
                </h1>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EDF3F0] text-[#0B5D45] uppercase tracking-wider">
                  <CheckCircle2 size={12} />
                  <span>{user.role || "Guest"}</span>
                </span>
              </div>
              <p className="text-sm text-[#6B6B67] mt-1 flex items-center gap-1.5">
                <Mail size={14} className="text-[#8B8B86]" />
                <span>{user.email}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>

        {/* Navigation & Services Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Trips Card */}
          <Link
            href="/trips"
            className="bg-white border border-[#E7E5E0] hover:border-[#0B5D45] rounded-2xl p-6 transition-all hover:shadow-md group block"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Calendar size={22} />
              </div>
              <ChevronRight size={18} className="text-[#8B8B86] group-hover:text-[#0B5D45] transition-colors mt-2" />
            </div>
            <h2 className="text-lg font-bold text-[#171717] group-hover:text-[#0B5D45] transition-colors">
              My Trips &amp; Reservations
            </h2>
            <p className="text-sm text-[#6B6B67] mt-1.5 leading-relaxed">
              Review your upcoming stays, access gate clearance codes, and view reservation history.
            </p>
          </Link>

          {/* Host Portal Card */}
          <Link
            href={isHost ? "/host/dashboard" : "/become-a-host"}
            className="bg-white border border-[#E7E5E0] hover:border-[#0B5D45] rounded-2xl p-6 transition-all hover:shadow-md group block"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Building2 size={22} />
              </div>
              <ChevronRight size={18} className="text-[#8B8B86] group-hover:text-[#0B5D45] transition-colors mt-2" />
            </div>
            <h2 className="text-lg font-bold text-[#171717] group-hover:text-[#0B5D45] transition-colors">
              {isHost ? "Host Dashboard" : "Become a Host"}
            </h2>
            <p className="text-sm text-[#6B6B67] mt-1.5 leading-relaxed">
              {isHost
                ? "Manage your properties, review listing requests, and track your reservation earnings."
                : "Earn extra income by listing your apartment, villa, or residence for verified travelers."}
            </p>
          </Link>

          {/* Admin Management (if role === 'admin') */}
          {isAdmin && (
            <Link
              href="/admin"
              className="bg-amber-50/50 border border-amber-200 hover:border-amber-400 rounded-2xl p-6 transition-all hover:shadow-md group block md:col-span-2"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <ShieldCheck size={22} />
                </div>
                <ChevronRight size={18} className="text-amber-600 group-hover:text-amber-800 transition-colors mt-2" />
              </div>
              <h2 className="text-lg font-bold text-amber-950 group-hover:text-amber-900 transition-colors">
                Platform Administration
              </h2>
              <p className="text-sm text-amber-800/80 mt-1.5 leading-relaxed">
                Review submitted properties from hosts, approve/reject listings, monitor bookings, and inspect system audit logs.
              </p>
            </Link>
          )}
        </div>

        {/* Personal Information */}
        <div className="bg-white border border-[#E7E5E0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[#F2F0EB] pb-4">
            <h2 className="text-lg font-bold text-[#171717]">Account Information</h2>
            <p className="text-sm text-[#6B6B67] mt-0.5">
              Personal contact details used for reservation communication.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86] block mb-1">
                First Name
              </label>
              <p className="text-[15px] font-medium text-[#171717]">{user.firstName || "Not provided"}</p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86] block mb-1">
                Last Name
              </label>
              <p className="text-[15px] font-medium text-[#171717]">{user.lastName || "Not provided"}</p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86] block mb-1">
                Email Address
              </label>
              <p className="text-[15px] font-medium text-[#171717]">{user.email}</p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86] block mb-1">
                Phone Number
              </label>
              <p className="text-[15px] font-medium text-[#171717]">{user.phone || "Not provided"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
