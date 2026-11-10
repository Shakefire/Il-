"use client"

import Link from "next/link"
import type { HostAlert } from "./types"

type Props = {
  alerts: HostAlert[]
  loading?: boolean
  error?: string | null
}

const NotificationsPanel = ({ alerts, loading, error }: Props) => {
  if (loading) {
    return <p className="text-sm text-[#6B6B67]">Loading alerts…</p>
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
        {error}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="space-y-2 py-10">
        <h2 className="text-lg font-semibold text-[#171717]">No host alerts right now</h2>
        <p className="text-sm text-[#6B6B67]">
          Reservation requests, KYC reminders, and unread host inbox items appear here.
        </p>
        <Link href="/notifications" className="text-sm text-[#0B5D45] underline-offset-4 hover:underline">
          Open full inbox
        </Link>
      </div>
    )
  }

  return (
    <section className="space-y-4" aria-label="Host alerts">
      <div>
        <h2 className="text-lg font-semibold text-[#171717]">Host alerts</h2>
        <p className="text-sm text-[#6B6B67]">Action items beyond the shared inbox.</p>
      </div>
      <ul className="divide-y divide-[#E7E5E0]">
        {alerts.map((a) => (
          <li key={a.id} className="py-4 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] uppercase tracking-wide font-semibold ${
                  a.severity === "action"
                    ? "text-amber-800"
                    : a.severity === "warning"
                      ? "text-red-700"
                      : "text-[#6B6B67]"
                }`}
              >
                {a.severity}
              </span>
              <span className="text-sm font-semibold text-[#171717]">{a.title}</span>
            </div>
            <p className="text-sm text-[#3F3F3B]">{a.body}</p>
            {a.href && (
              <Link
                href={a.href}
                className="inline-flex min-h-[44px] items-center text-sm text-[#0B5D45] underline-offset-4 hover:underline"
              >
                Open
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default NotificationsPanel
