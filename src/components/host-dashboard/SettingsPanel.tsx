"use client"

import Link from "next/link"

type Props = {
  onboardingStatus?: {
    verificationStatus?: string
    completionPct?: number
    currentStep?: number
  } | null
  bankVerified?: boolean
  bankLabel?: string | null
  onOpenBank: () => void
}

const SettingsPanel = ({ onboardingStatus, bankVerified, bankLabel, onOpenBank }: Props) => {
  return (
    <section className="space-y-8 max-w-xl" aria-label="Host settings">
      <div>
        <h2 className="text-lg font-semibold text-[#171717]">Account &amp; verification</h2>
        <p className="text-sm text-[#6B6B67]">
          KYC approval is required before publishing. Bank verification is required before withdrawals.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[#8B8B86]">KYC status</p>
        <p className="text-base font-medium text-[#171717]">
          {onboardingStatus?.verificationStatus || "UNKNOWN"}
        </p>
        <Link
          href="/host/onboarding/status"
          className="inline-flex min-h-[44px] items-center text-sm text-[#0B5D45] underline-offset-4 hover:underline"
        >
          Open onboarding
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[#8B8B86]">Payout bank</p>
        <p className="text-base font-medium text-[#171717]">
          {bankVerified ? bankLabel || "Verified account on file" : "No verified payout account"}
        </p>
        <button
          type="button"
          onClick={onOpenBank}
          className="min-h-[44px] px-4 border border-[#E7E5E0] text-sm font-semibold text-[#171717]"
          aria-label="Manage payout bank account"
        >
          {bankVerified ? "Update bank account" : "Add bank account"}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[#8B8B86]">Notification preferences</p>
        <Link
          href="/profile/notifications"
          className="inline-flex min-h-[44px] items-center text-sm text-[#0B5D45] underline-offset-4 hover:underline"
        >
          Manage email, SMS, and push preferences
        </Link>
      </div>
    </section>
  )
}

export default SettingsPanel
