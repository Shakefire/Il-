"use client"

import { remainingHostSeconds } from "./types"

type Props = {
  deadlineAt?: string | null
  nowMs?: number
  label?: string
}

/** Displays remaining seconds until server-side host response deadline (120s window). */
const HostCountdown = ({ deadlineAt, nowMs = Date.now(), label = "Host response window" }: Props) => {
  const secs = remainingHostSeconds(deadlineAt, nowMs)
  return (
    <p className="text-xs font-medium text-[#6B6B67]" aria-live="polite">
      {label}: {secs > 0 ? `${secs}s left` : "Expired on server"}
    </p>
  )
}

export default HostCountdown
