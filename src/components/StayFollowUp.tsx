"use client"

import { useState } from "react"
import { api } from "@/lib/api"

type Stay = {
  id: string
  status: string
  checkOutDate: string
}

export function StayFollowUp({ booking }: { booking: Stay }) {
  const today = new Date().toISOString().slice(0, 10)
  const canReview =
    (booking.status === "CONFIRMED" || booking.status === "COMPLETED") &&
    booking.checkOutDate < today
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("BOOKING")
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleReview = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await api.createReview({ bookingId: booking.id, overallRating: rating, body: review })
      setNotice("Review submitted.")
      setReview("")
    } catch (err: any) {
      setNotice(err.message || "Could not submit review.")
    } finally {
      setBusy(false)
    }
  }

  const handleCase = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await api.createSupportCase({
        bookingId: booking.id,
        category,
        subject: `Stay ${booking.id}`,
        message,
      })
      setNotice("Support case opened. Ilé will reply in the app. This does not issue a refund.")
      setMessage("")
    } catch (err: any) {
      setNotice(err.message || "Could not open a case.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full space-y-3 border-t border-[#E7E5E0] pt-3">
      {canReview && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#171717]" htmlFor={`rating-${booking.id}`}>
            Review this stay
          </label>
          <div className="flex gap-2">
            <select
              id={`rating-${booking.id}`}
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              className="rounded-lg border border-[#E7E5E0] px-2 py-2 text-sm"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>{value} stars</option>
              ))}
            </select>
            <input
              value={review}
              onChange={(event) => setReview(event.target.value)}
              placeholder="How was the stay?"
              className="flex-1 rounded-lg border border-[#E7E5E0] px-3 py-2 text-sm"
              aria-label="Review text"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleReview}
              className="rounded-lg bg-[#0B5D45] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Submit
            </button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#171717]" htmlFor={`support-${booking.id}`}>
          Ask support about this stay
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Support category"
            className="rounded-lg border border-[#E7E5E0] px-2 py-2 text-sm"
          >
            <option value="BOOKING">Booking</option>
            <option value="PAYMENT">Payment</option>
            <option value="REFUND_REQUEST">Refund request</option>
            <option value="ACCESS">Access</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            id={`support-${booking.id}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the issue. Refunds are reviewed by admin."
            className="flex-1 rounded-lg border border-[#E7E5E0] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || message.trim().length < 3}
            onClick={handleCase}
            className="rounded-lg border border-[#0B5D45] px-3 py-2 text-sm font-semibold text-[#0B5D45] disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
      {notice && <p className="text-xs text-[#4A4A45]">{notice}</p>}
    </div>
  )
}
