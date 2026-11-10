"use client"

import Link from "next/link"
import { formatNaira } from "@/lib/utils"
import { HostMessages } from "@/lib/host-messages"
import type { HostAlert, HostBooking, HostDashboardStats } from "./types"
import { remainingHostSeconds } from "./types"

type Props = {
  stats: HostDashboardStats | null
  pendingRequests: HostBooking[]
  walletAvailable: number
  onOpenReservations: () => void
  onOpenListings: () => void
  onOpenEarnings: () => void
  nowMs?: number
}

const OverviewPanel = ({
  stats,
  pendingRequests,
  walletAvailable,
  onOpenReservations,
  onOpenListings,
  onOpenEarnings,
  nowMs = Date.now(),
}: Props) => {
  const alerts: HostAlert[] = stats?.alerts || []
  const occupancy = stats?.occupancy
  const hostEarnings = stats?.earnings?.lifetimeHostEarnings ?? stats?.earnings?.totalNet ?? 0

  return (
    <section className="space-y-8" aria-label="Host overview">
      <div className="space-y-2">
        <p className="font-display text-3xl sm:text-4xl text-[#0B5D45]">Ilé Host</p>
        <h2 className="text-xl font-semibold text-[#171717]">{HostMessages.overviewTitle}</h2>
        <p className="text-sm text-[#6B6B67] max-w-2xl">
          {HostMessages.overviewBody}
        </p>
      </div>

      {pendingRequests.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/80 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">
            {pendingRequests.length} reservation request{pendingRequests.length === 1 ? "" : "s"} need a response
          </h3>
          <ul className="space-y-2">
            {pendingRequests.slice(0, 3).map((b) => {
              const secs = remainingHostSeconds(b.hostResponseDeadlineAt, nowMs)
              return (
                <li key={b.id} className="text-sm text-amber-950 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-medium">
                    {b.guestFirstName} {b.guestLastName}
                  </span>
                  <span>{b.referenceCode}</span>
                  <span aria-live="polite">
                    {secs > 0 ? `${secs}s remaining` : "Deadline passed — server will expire"}
                  </span>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={onOpenReservations}
            className="min-h-[44px] px-4 text-sm font-semibold bg-[#0B5D45] text-white"
            aria-label="Open reservation requests"
          >
            Respond now
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenEarnings}
          className="text-left space-y-1 min-h-[44px]"
          aria-label="Open earnings"
        >
          <p className="text-xs uppercase tracking-wide text-[#8B8B86]">{HostMessages.availableToWithdraw}</p>
          <p className="text-2xl font-semibold text-[#0B5D45] tabular-nums">{formatNaira(walletAvailable)}</p>
        </button>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[#8B8B86]">{HostMessages.lifetimeEarnings}</p>
          <p className="text-2xl font-semibold text-[#171717]">{formatNaira(hostEarnings)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[#8B8B86]">
            Occupancy ({occupancy?.windowDays || 30}d)
          </p>
          <p className="text-2xl font-semibold text-[#171717]">
            {occupancy ? `${Math.round((occupancy.occupancyRate || 0) * 100)}%` : "—"}
          </p>
          {occupancy && (
            <p className="text-xs text-[#8B8B86]">
              {occupancy.bookedNights} booked / {occupancy.availableNights} available nights
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenListings}
          className="min-h-[44px] px-4 border border-[#0B5D45] text-[#0B5D45] text-sm font-semibold"
        >
          {HostMessages.manageListings}
        </button>
        <Link
          href="/host/onboarding/status"
          className="min-h-[44px] px-4 inline-flex items-center text-sm font-semibold text-[#6B6B67] underline-offset-4 hover:underline"
        >
          {HostMessages.identityStatus}
        </Link>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#171717]">Alerts</h3>
          <ul className="space-y-2">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="text-sm text-[#3F3F3B]">
                <span className="font-medium">{a.title}</span>
                <span className="text-[#6B6B67]"> — {a.body}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default OverviewPanel
