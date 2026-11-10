"use client"

import Link from "next/link"
import {
  hostVerificationDetail,
  hostVerificationLabel,
  HostMessages,
} from "@/lib/host-messages"

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
  const status = onboardingStatus?.verificationStatus || ""
  return (
    <section className="space-y-8 max-w-xl" aria-label="Host settings">
      <div>
        <h2 className="text-lg font-semibold text-[#171717]">Account &amp; verification</h2>
        <p className="text-sm text-[#6B6B67]">
          Identity verification is required before publishing. A verified Nigerian bank account is required before withdrawals.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[#8B8B86]">{HostMessages.identityStatus}</p>
        <p className="text-base font-medium text-[#171717]">
          {hostVerificationLabel(status)}
        </p>
        <p className="text-sm text-[#6B6B67]">{hostVerificationDetail(status)}</p>
        <Link
          href="/host/onboarding/status"
          className="inline-flex min-h-[44px] items-center text-sm text-[#0B5D45] underline-offset-4 hover:underline"
        >
          Open identity verification
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[#8B8B86]">Payout bank</p>
        <p className="text-sm text-[#3F3F3B]">
          {bankVerified
            ? bankLabel || "Verified Nigerian bank account on file"
            : HostMessages.bankRequiredBody}
        </p>
        <button
          type="button"
          onClick={onOpenBank}
          className="min-h-[44px] px-4 text-sm font-semibold bg-[#0B5D45] text-white"
          aria-label="Manage payout bank account"
        >
          {bankVerified ? "Update bank account" : "Add bank account"}
        </button>
      </div>
    </section>
  )
}

export default SettingsPanel
