"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"

type SavedStay = {
  id: string
  slug: string
  title: string
  city?: string
  neighborhood?: string
  pricePerNight?: number
  coverImage?: string
}

export default function SavedStaysPage() {
  const [stays, setStays] = useState<SavedStay[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const body = await api.getFavourites()
      setStays(body.favourites || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || "Sign in to see saved stays.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-[#171717]">Saved stays</h1>
      <p className="mt-2 text-sm text-[#6B6B67]">Stays you save are stored on your account.</p>
      {loading && <p className="mt-6 text-sm">Loading saved stays…</p>}
      {error && <p className="mt-6 text-sm text-[#8A3A2A]">{error}</p>}
      <ul className="mt-6 space-y-3">
        {stays.map((stay) => (
          <li key={stay.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E5E0] bg-white p-4">
            <div>
              <Link href={`/stay/${stay.slug}`} className="font-semibold text-[#171717] underline">
                {stay.title}
              </Link>
              <p className="text-xs text-[#6B6B67]">
                {[stay.neighborhood, stay.city].filter(Boolean).join(", ")}
              </p>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-[#E7E5E0] px-3 text-sm"
              onClick={async () => {
                await api.removeFavourite(stay.id)
                load()
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {!loading && !error && stays.length === 0 && (
        <p className="mt-6 text-sm text-[#6B6B67]">No saved stays yet.</p>
      )}
    </main>
  )
}
