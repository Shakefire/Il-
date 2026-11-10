"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Mail,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Building2,
  Bell,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { authApi } from "@/lib/auth"

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?next=/profile")
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName || "")
    setLastName(user.lastName || "")
    setPhone(user.phone || "")
  }, [user])

  if (isLoading || !user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
      </div>
    )
  }

  const isHost = user.role === "host"
  const isAdmin = user.role === "admin"
  const canEditGuestFields = !isHost || user.role === "guest" || user.role === "host" || !isAdmin
  // Guests and hosts can update name/phone; no wallet/currency fields.

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      await authApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      })
      await refreshUser()
      setMessage("Profile updated.")
    } catch (err: any) {
      setError(err.message || "Could not save profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white border border-[#E7E5E0] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-[#0B5D45] text-white flex items-center justify-center font-display text-3xl font-normal shadow-sm">
              {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-[#171717]">
                  {user.firstName
                    ? `${user.firstName} ${user.lastName || ""}`.trim()
                    : "User Profile"}
                </h1>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EDF3F0] text-[#0B5D45] uppercase tracking-wider">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            href="/trips"
            className="bg-white border border-[#E7E5E0] hover:border-[#0B5D45] rounded-2xl p-6 transition-all hover:shadow-md group block"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Calendar size={22} />
              </div>
              <ChevronRight
                size={18}
                className="text-[#8B8B86] group-hover:text-[#0B5D45] transition-colors mt-2"
              />
            </div>
            <h2 className="text-lg font-bold text-[#171717] group-hover:text-[#0B5D45] transition-colors">
              My Trips &amp; Reservations
            </h2>
            <p className="text-sm text-[#6B6B67] mt-1.5 leading-relaxed">
              Review upcoming stays and reservation history.
            </p>
          </Link>

          <Link
            href="/notifications"
            className="bg-white border border-[#E7E5E0] hover:border-[#0B5D45] rounded-2xl p-6 transition-all hover:shadow-md group block"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Bell size={22} />
              </div>
              <ChevronRight
                size={18}
                className="text-[#8B8B86] group-hover:text-[#0B5D45] transition-colors mt-2"
              />
            </div>
            <h2 className="text-lg font-bold text-[#171717] group-hover:text-[#0B5D45] transition-colors">
              Notifications
            </h2>
            <p className="text-sm text-[#6B6B67] mt-1.5 leading-relaxed">
              Booking updates and account alerts in one inbox.
            </p>
          </Link>

          <Link
            href={isHost ? "/host/dashboard" : "/become-a-host"}
            className="bg-white border border-[#E7E5E0] hover:border-[#0B5D45] rounded-2xl p-6 transition-all hover:shadow-md group block md:col-span-2"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Building2 size={22} />
              </div>
              <ChevronRight
                size={18}
                className="text-[#8B8B86] group-hover:text-[#0B5D45] transition-colors mt-2"
              />
            </div>
            <h2 className="text-lg font-bold text-[#171717] group-hover:text-[#0B5D45] transition-colors">
              {isHost ? "Host Dashboard" : "Become a Host"}
            </h2>
            <p className="text-sm text-[#6B6B67] mt-1.5 leading-relaxed">
              {isHost
                ? "Manage properties and track reservation earnings."
                : "List your apartment or villa for verified travelers."}
            </p>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="bg-amber-50/50 border border-amber-200 hover:border-amber-400 rounded-2xl p-6 transition-all hover:shadow-md group block md:col-span-2"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <ShieldCheck size={22} />
                </div>
                <ChevronRight
                  size={18}
                  className="text-amber-600 group-hover:text-amber-800 transition-colors mt-2"
                />
              </div>
              <h2 className="text-lg font-bold text-amber-950 group-hover:text-amber-900 transition-colors">
                Platform Administration
              </h2>
              <p className="text-sm text-amber-800/80 mt-1.5 leading-relaxed">
                Review listings, monitor bookings, and inspect audit logs.
              </p>
            </Link>
          )}
        </div>

        <form
          onSubmit={handleSave}
          className="bg-white border border-[#E7E5E0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="border-b border-[#F2F0EB] pb-4">
            <h2 className="text-lg font-bold text-[#171717]">Account Information</h2>
            <p className="text-sm text-[#6B6B67] mt-0.5">
              Name and phone used for reservation communication. Email cannot be
              changed here. No wallet or currency preference on guest profile.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                First Name
              </span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E7E5E0] px-3 py-2.5 text-[15px] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]/40"
                autoComplete="given-name"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                Last Name
              </span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E7E5E0] px-3 py-2.5 text-[15px] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]/40"
                autoComplete="family-name"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                Email Address
              </span>
              <input
                type="email"
                value={user.email}
                disabled
                className="mt-1.5 w-full rounded-xl border border-[#E7E5E0] bg-[#F7F6F3] px-3 py-2.5 text-[15px] text-[#6B6B67]"
                aria-readonly="true"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                Phone Number
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E7E5E0] px-3 py-2.5 text-[15px] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]/40"
                autoComplete="tel"
                placeholder="0803…"
              />
            </label>
          </div>

          {message && (
            <p className="text-sm text-[#0B5D45]" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {canEditGuestFields && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#0B5D45] text-white text-sm font-semibold hover:bg-[#094c38] disabled:opacity-60 transition-colors min-h-[44px]"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
