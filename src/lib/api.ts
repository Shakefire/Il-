// Unified Ilé Frontend API Client

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("ile_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // Properties
  async getProperties() {
    const res = await fetch("/api/properties", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load properties");
    return res.json();
  },

  async getProperty(slug: string) {
    const res = await fetch(`/api/properties/${encodeURIComponent(slug)}`, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to load property");
    }
    return res.json();
  },

  // Search
  async search(params: {
    location?: string;
    lat?: number | string;
    lng?: number | string;
    radius?: number | string;
    checkIn?: string;
    checkOut?: string;
    guests?: number | string;
    type?: string;
    bedrooms?: number | string;
    maxPrice?: number | string;
    minPrice?: number | string;
    powerType?: string;
  }) {
    const query = new URLSearchParams();
    if (params.location) query.set("location", params.location);
    if (params.lat) query.set("lat", String(params.lat));
    if (params.lng) query.set("lng", String(params.lng));
    if (params.radius) query.set("radius", String(params.radius));
    if (params.checkIn) query.set("checkIn", params.checkIn);
    if (params.checkOut) query.set("checkOut", params.checkOut);
    if (params.guests) query.set("guests", String(params.guests));
    if (params.type && params.type !== "All Types") query.set("type", params.type);
    if (params.bedrooms) query.set("bedrooms", String(params.bedrooms));
    if (params.maxPrice) query.set("maxPrice", String(params.maxPrice));
    if (params.minPrice) query.set("minPrice", String(params.minPrice));
    if (params.powerType) query.set("powerType", params.powerType);

    const res = await fetch(`/api/search?${query.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error("Search request failed");
    return res.json();
  },

  // Bookings
  async createBooking(data: {
    propertyId: string;
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    guestPhone: string;
    guestCount: number;
    checkInDate: string;
    checkOutDate: string;
  }) {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to create booking");
    return body;
  },

  async payBooking(
    bookingId: string,
    data: {
      paymentMethod?: string;
      paymentReference?: string;
    },
    accessToken?: string
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    };
    if (accessToken) headers["X-Access-Token"] = accessToken;

    const res = await fetch(`/api/bookings/${bookingId}/pay`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Payment processing failed");
    return body;
  },

  async getBooking(bookingId: string, accessToken?: string) {
    const headers: Record<string, string> = { ...getAuthHeader() };
    if (accessToken) headers["X-Access-Token"] = accessToken;

    const res = await fetch(`/api/bookings/${bookingId}`, {
      headers,
      credentials: "include",
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load booking details");
    return body;
  },

  async getBookingContact(bookingId: string, accessToken?: string) {
    const headers: Record<string, string> = { ...getAuthHeader() };
    if (accessToken) headers["X-Access-Token"] = accessToken;

    const res = await fetch(`/api/bookings/${bookingId}/contact`, {
      headers,
      credentials: "include",
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Access denied to quarantine details");
    return body;
  },

  async getUserBookings() {
    const res = await fetch("/api/bookings", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load user bookings");
    return res.json();
  },

  async checkAvailability(propertyId: string, checkIn: string, checkOut: string) {
    const params = new URLSearchParams({ propertyId, checkIn, checkOut });
    const res = await fetch(`/api/bookings/availability?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to check property availability");
    return res.json();
  },

  async cancelBooking(bookingId: string, accessToken?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    };
    if (accessToken) headers["X-Access-Token"] = accessToken;

    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ accessToken }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to cancel booking");
    return body;
  },

  // Host API
  async getHostDashboard() {
    const res = await fetch("/api/host/dashboard", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load host dashboard");
    return res.json();
  },

  async getHostBookings() {
    const res = await fetch("/api/host/bookings", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load host bookings");
    return res.json();
  },

  async getHostProperties() {
    const res = await fetch("/api/host/properties", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load host properties");
    return res.json();
  },

  async createHostProperty(propertyData: any) {
    const res = await fetch("/api/host/properties", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify(propertyData),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to create property listing");
    return body;
  },

  async submitPropertyForReview(propertyId: string) {
    const res = await fetch(`/api/host/properties/${propertyId}/submit`, {
      method: "POST",
      headers: getAuthHeader(),
      credentials: "include",
    });
    const body = await res.json();
    if (!res.ok) {
      const msg =
        body.missingFields && body.missingFields.length > 0
          ? `${body.error}\n\nMissing required details:\n• ${body.missingFields.join("\n• ")}`
          : body.error || "Failed to submit property for review";
      throw new Error(msg);
    }
    return body;
  },

  async updateHostProperty(propertyId: string, propertyData: any) {
    const res = await fetch(`/api/host/properties/${propertyId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify(propertyData),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to update property listing");
    return body;
  },

  async deleteHostProperty(propertyId: string) {
    const res = await fetch(`/api/host/properties/${propertyId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
      credentials: "include",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to delete property listing");
    return body;
  },

  async getHostProfile() {
    const res = await fetch("/api/host/profile", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load host profile");
    return res.json();
  },

  async updateHostProfile(profileData: any) {
    const res = await fetch("/api/host/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify(profileData),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to update host profile");
    return body;
  },

  async getHostPropertyAvailability(propertyId: string) {
    const res = await fetch(`/api/host/properties/${propertyId}/availability`, {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load property availability");
    return res.json();
  },

  async blockHostPropertyDates(propertyId: string, data: { startDate: string; endDate: string; notes?: string }) {
    const res = await fetch(`/api/host/properties/${propertyId}/availability/block`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to block property dates");
    return body;
  },

  async unblockHostPropertyDates(propertyId: string, blockId: string) {
    const res = await fetch(`/api/host/properties/${propertyId}/availability/block/${blockId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
      credentials: "include",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to unblock property dates");
    return body;
  },

  // Admin API
  async getAdminStats() {
    const res = await fetch("/api/admin/stats", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load admin stats");
    return res.json();
  },

  async getAdminProperties(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`/api/admin/properties${query}`, {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load admin properties");
    return res.json();
  },

  async approveProperty(propertyId: string) {
    const res = await fetch(`/api/admin/properties/${propertyId}/approve`, {
      method: "POST",
      headers: getAuthHeader(),
      credentials: "include",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to approve property");
    return body;
  },

  async rejectProperty(propertyId: string, reason?: string) {
    const res = await fetch(`/api/admin/properties/${propertyId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to reject property");
    return body;
  },

  async suspendProperty(propertyId: string) {
    const res = await fetch(`/api/admin/properties/${propertyId}/suspend`, {
      method: "POST",
      headers: getAuthHeader(),
      credentials: "include",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to suspend property");
    return body;
  },

  async getAdminBookings() {
    const res = await fetch("/api/admin/bookings", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load admin bookings");
    return res.json();
  },

  async getAdminAuditLogs() {
    const res = await fetch("/api/admin/audit-logs", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load audit logs");
    return res.json();
  },

  // Payments API (Paystack Integration)
  async initializePayment(bookingIdOrRef: string) {
    const res = await fetch("/api/payments/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify({ bookingId: bookingIdOrRef }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to initialize payment");
    return body;
  },

  async verifyPayment(reference: string) {
    const res = await fetch(`/api/payments/verify/${encodeURIComponent(reference)}`, {
      headers: getAuthHeader(),
      credentials: "include",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Payment verification failed");
    return body;
  },

  // Health API
  async getSystemHealth() {
    const res = await fetch("/api/health/detailed");
    if (!res.ok) throw new Error("Health check failed");
    return res.json();
  },

  async sendTestEmail(to?: string) {
    const res = await fetch("/api/health/test-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      credentials: "include",
      body: JSON.stringify({ to }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to send test email");
    return body;
  },
};
