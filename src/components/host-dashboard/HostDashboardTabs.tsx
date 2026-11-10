"use client"

import {
  Home,
  Calendar,
  CalendarCheck,
  Wallet,
  LayoutDashboard,
  Bell,
  Settings,
} from "lucide-react"
import type { HostDashboardTab } from "./types"

type TabDef = {
  id: HostDashboardTab
  label: string
  icon: typeof Home
  count?: number
}

type Props = {
  activeTab: HostDashboardTab
  onChange: (tab: HostDashboardTab) => void
  counts: {
    properties: number
    bookings: number
    alerts: number
  }
}

const HostDashboardTabs = ({ activeTab, onChange, counts }: Props) => {
  const tabs: TabDef[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "properties", label: `Listings (${counts.properties})`, icon: Home },
    { id: "bookings", label: `Reservations (${counts.bookings})`, icon: Calendar },
    { id: "calendar", label: "Calendar", icon: CalendarCheck },
    { id: "financials", label: "Earnings", icon: Wallet },
    { id: "notifications", label: counts.alerts > 0 ? `Alerts (${counts.alerts})` : "Alerts", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="flex border-b border-[#E7E5E0] gap-6 sm:gap-8 overflow-x-auto" role="tablist" aria-label="Host dashboard sections">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            aria-label={tab.label}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onChange(tab.id)
              }
            }}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer min-h-[44px] ${
              isActive
                ? "border-[#0B5D45] text-[#0B5D45]"
                : "border-transparent text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default HostDashboardTabs
