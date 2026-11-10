"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

type InboxItem = {
  id: string
  title: string
  body: string
  eventType?: string
  deepLink?: string | null
  readAt?: string | null
  createdAt?: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [items, setItems] = useState<InboxItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("ile_token") : null
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch("/api/notifications?limit=50", {
        credentials: "include",
        headers,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load notifications")
      setItems(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (err: any) {
      setError(err.message || "Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?next=/notifications")
      return
    }
    if (isAuthenticated) void load()
  }, [isLoading, isAuthenticated, router, load])

  const handleMarkAll = async () => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("ile_token") : null
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (token) headers.Authorization = `Bearer ${token}`
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
        headers,
      })
      await load()
    } catch {
      // Keep list as-is; user can refresh.
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("ile_token") : null
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (token) headers.Authorization = `Bearer ${token}`
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
        headers,
      })
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item
        )
      )
      setUnreadCount((n) => Math.max(0, n - 1))
    } catch {
      // ignore
    }
  }

  if (isLoading || (!isAuthenticated && loading)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-[#171717]">Notifications</h1>
            <p className="text-sm text-[#6B6B67] mt-1">
              Booking and account updates for your Ilé stays.
              {unreadCount > 0 ? ` ${unreadCount} unread.` : ""}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#0B5D45] hover:bg-[#EDF3F0] rounded-xl transition-colors"
              aria-label="Mark all notifications as read"
            >
              <CheckCheck size={16} />
              Mark all read
            </button>
          )}
        </div>

        {loading && (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
            <Bell className="mx-auto text-[#8B8B86]" size={28} aria-hidden />
            <p className="mt-3 text-[#171717] font-medium">No notifications yet</p>
            <p className="mt-1 text-sm text-[#6B6B67]">
              Updates about bookings and account security will appear here.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <ul className="space-y-3" aria-label="Notification inbox">
            {items.map((item) => {
              const isUnread = !item.readAt
              const content = (
                <div
                  className={`rounded-2xl border px-5 py-4 transition-colors ${
                    isUnread
                      ? "border-[#0B5D45]/30 bg-white"
                      : "border-[#E7E5E0] bg-white/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#171717]">{item.title}</p>
                      <p className="text-sm text-[#6B6B67] mt-1 leading-relaxed">
                        {item.body}
                      </p>
                      {item.createdAt && (
                        <p className="text-xs text-[#8B8B86] mt-2">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {isUnread && (
                      <span
                        className="mt-1 w-2.5 h-2.5 rounded-full bg-[#0B5D45] shrink-0"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                </div>
              )

              if (item.deepLink) {
                return (
                  <li key={item.id}>
                    <Link
                      href={item.deepLink}
                      onClick={() => {
                        if (isUnread) void handleMarkRead(item.id)
                      }}
                      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D45] rounded-2xl"
                    >
                      {content}
                    </Link>
                  </li>
                )
              }

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D45] rounded-2xl"
                    onClick={() => {
                      if (isUnread) void handleMarkRead(item.id)
                    }}
                  >
                    {content}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
