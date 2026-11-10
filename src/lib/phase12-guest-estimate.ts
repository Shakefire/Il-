import { calculatePaystackFee } from "./utils"

/**
 * Display-only estimate before a reservation exists.
 * The payable amount is the server totalAmount returned on create / get booking.
 * Platform commission is not shown to guests.
 */
export const REVIEW_NO_PAYMENT_COPY =
  "No payment is required yet. The host must confirm availability. This total is an estimate — the server sets the payable amount when you send the request."

export type GuestStayEstimate = {
  nightlyRate: number
  nights: number
  accommodationSubtotal: number
  processingFee: number
  estimatedTotal: number
  isFinalPayable: false
}

export function estimateGuestStay(nightlyRate: number, nights: number): GuestStayEstimate {
  const safeNightly = Math.max(0, Math.round(nightlyRate))
  const safeNights = Math.max(0, Math.round(nights))
  const accommodationSubtotal = safeNightly * safeNights
  const processingFee = calculatePaystackFee(accommodationSubtotal)
  return {
    nightlyRate: safeNightly,
    nights: safeNights,
    accommodationSubtotal,
    processingFee,
    estimatedTotal: accommodationSubtotal + processingFee,
    isFinalPayable: false,
  }
}
