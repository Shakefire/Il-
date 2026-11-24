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

export default function AdminSupportPage() {
  const [cases, setCases] = useState<SupportCase[]>([])
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const load = async () => {
    try {
      const body = await api.getSupportCases()
      setCases(body.cases || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || "Admin sign-in required.")
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-[#171717]">Support cases</h1>
      <p className="mt-2 text-sm text-[#6B6B67]">
        Replies stay on the case. They do not execute a refund or change a booking.
      </p>
      {error && <p className="mt-4 text-sm text-[#8A3A2A]">{error}</p>}
      <ul className="mt-6 space-y-4">
        {cases.map((item) => (
          <li key={item.id} className="rounded-2xl border border-[#E7E5E0] bg-white p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B67]">
              {item.category} · {item.status}
            </p>
            <h2 className="font-semibold text-[#171717]">{item.subject}</h2>
            <p className="text-sm text-[#4A4A45]">{item.message}</p>
            {item.adminResponse && <p className="text-sm text-[#0B5D45]">Reply: {item.adminResponse}</p>}
            <label className="block text-xs font-semibold" htmlFor={`reply-${item.id}`}>
              Admin response
            </label>
            <textarea
              id={`reply-${item.id}`}
              value={drafts[item.id] || ""}
              onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
              className="w-full rounded-lg border border-[#E7E5E0] p-2 text-sm"
              rows={3}
            />
            <button
              type="button"
              className="min-h-11 rounded-lg bg-[#0B5D45] px-4 text-sm font-semibold text-white"
              onClick={async () => {
                await api.respondSupportCase(item.id, {
                  response: drafts[item.id] || "",
                  status: "IN_REVIEW",
                })
                load()
              }}
            >
              Save reply
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
