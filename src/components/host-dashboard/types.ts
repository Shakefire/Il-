export type HostDashboardTab =
  | "overview"
  | "properties"
  | "bookings"
  | "calendar"
  | "financials"
  | "notifications"
  | "settings"

export type HostProperty = {
  id: string
  slug: string
  title: string
  city: string
  neighborhood: string
  status: string
  pricePerNight: number
  hostBasePrice?: number | null
  coverImage: string
  imageCount?: number
  bedrooms?: number
  bathrooms?: number
  maxGuests?: number
}

export type HostBooking = {
  id: string
  referenceCode: string
  propertyId: string
  propertyTitle?: string
  guestFirstName: string
  guestLastName: string
  guestEmail?: string
  guestPhone?: string
  guestCount: number
  checkInDate: string
  checkOutDate: string
  numberOfNights: number
  status: string
  bookingStatus?: string
  hostNetAmount?: number
  accommodationSubtotal?: number
  totalAmount?: number
  hostResponseDeadlineAt?: string | null
  paymentDeadlineAt?: string | null
  createdAt?: string
}

export type HostAlert = {
  id: string
  type: string
  severity: "info" | "warning" | "action"
  title: string
  body: string
  href?: string
  createdAt: string
}

export type HostOccupancy = {
  windowDays: number
  listingCount: number
  availableNights: number
  bookedNights: number
  blockedNights: number
  occupancyRate: number
  formula: string
}

export type HostDashboardStats = {
  totalProperties: number
  published: number
  pending: number
  drafts: number
  rejected: number
  archived?: number
  earnings: {
    totalGross: number
    totalNet: number
    lifetimeGross?: number
    lifetimeHostEarnings?: number
    wallet?: {
      pending: number
      available: number
      processing: number
      paid: number
    }
    labels?: Record<string, string>
    byProperty?: Array<{
      propertyId: string
      title: string
      gross: number
      hostEarnings: number
      bookingCount: number
    }>
  }
  occupancy?: HostOccupancy
  alerts?: HostAlert[]
}

export const HOST_RESPONSE_WINDOW_SECONDS = 120

export const remainingHostSeconds = (deadlineAt?: string | null, nowMs = Date.now()) => {
  if (!deadlineAt) return 0
  const end = new Date(deadlineAt).getTime()
  if (Number.isNaN(end)) return 0
  return Math.max(0, Math.ceil((end - nowMs) / 1000))
}
