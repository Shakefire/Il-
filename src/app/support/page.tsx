"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type SupportCase = {
  id: string
  category: string
  subject: string
  message: string
  status: string
  adminResponse?: string | null
  bookingId?: string | null
}

const categories = ["BOOKING", "PAYMENT", "REFUND_REQUEST", "LISTING", "ACCESS", "OTHER"]

export default function SupportPage() {
  const [cases, setCases] = useState<SupportCase[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState("BOOKING")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [bookingId, setBookingId] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const body = await api.getSupportCases()
      setCases(body.cases || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || "Sign in to view your support cases.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await api.createSupportCase({
        category,
        subject,
        message,
        bookingId: bookingId.trim() || undefined,
      })
      setNotice("Request sent. An admin will reply here. This does not issue a refund.")
      setSubject("")
      setMessage("")
      setBookingId("")
      await load()
    } catch (err: any) {
      setNotice(err.message || "Could not open a case.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-[#171717]">Support</h1>
      <p className="mt-2 text-sm text-[#6B6B67]">
        Guests and hosts can ask about a booking. Refund requests are reviewed by Ilé admin. Sending a request does not move money.
      </p>
      <form
        className="mt-6 space-y-3 rounded-2xl border border-[#E7E5E0] bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <label className="block text-sm font-semibold" htmlFor="support-category">
          Category
        </label>
        <select
          id="support-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-full rounded-lg border border-[#E7E5E0] px-3 py-3 text-base"
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <label className="block text-sm font-semibold" htmlFor="support-subject">
          Subject
        </label>
        <input
          id="support-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-lg border border-[#E7E5E0] px-3 py-3 text-base"
          required
        />
        <label className="block text-sm font-semibold" htmlFor="support-booking">
          Booking id (optional)
        </label>
        <input
          id="support-booking"
          value={bookingId}
          onChange={(event) => setBookingId(event.target.value)}
          className="w-full rounded-lg border border-[#E7E5E0] px-3 py-3 text-base"
        />
        <label className="block text-sm font-semibold" htmlFor="support-message">
          Message
        </label>
        <textarea
          id="support-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-28 w-full rounded-lg border border-[#E7E5E0] px-3 py-3 text-base"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg bg-[#0B5D45] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send request"}
        </button>
        {notice && <p className="text-sm text-[#4A4A45]">{notice}</p>}
      </form>
      {loading && <p className="mt-6 text-sm">Loading your cases…</p>}
      {error && <p className="mt-6 text-sm text-[#8A3A2A]">{error}</p>}
      <ul className="mt-6 space-y-3">
        {cases.map((item) => (
          <li key={item.id} className="rounded-2xl border border-[#E7E5E0] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B67]">
              {item.category} · {item.status}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#171717]">{item.subject}</h2>
            <p className="mt-2 text-sm text-[#171717]">{item.message}</p>
            {item.adminResponse && (
              <p className="mt-3 text-sm text-[#0B5D45]">Admin: {item.adminResponse}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
