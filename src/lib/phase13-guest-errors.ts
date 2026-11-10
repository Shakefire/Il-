export type GuestFlowSurface = "search" | "property" | "request" | "payment" | "generic"

export type GuestFlowErrorCopy = {
  title: string
  message: string
}

function textOf(err: unknown): string {
  if (!err) return ""
  if (typeof err === "string") return err
  if (typeof err === "object" && err && "message" in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return ""
}

function statusOf(err: unknown): number | null {
  if (typeof err === "object" && err && "statusCode" in err) {
    const code = (err as { statusCode?: unknown }).statusCode
    if (typeof code === "number") return code
  }
  return null
}

/**
 * Concise guest-facing error titles. Does not invent fees or statuses.
 */
export function guestFlowError(err: unknown, surface: GuestFlowSurface = "generic"): GuestFlowErrorCopy {
  const raw = textOf(err)
  const lower = raw.toLowerCase()
  const status = statusOf(err)

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("socket") ||
    lower.includes("timeout") ||
    lower.includes("timed out")
  ) {
    return {
      title: "No internet",
      message: "Check your connection and try again.",
    }
  }

  if (status === 401 || status === 403 || lower.includes("authentication") || lower.includes("sign in")) {
    return {
      title: "Authentication required",
      message: "Sign in to continue. Public stays stay browsable without an account.",
    }
  }

  if (lower.includes("guest count") || lower.includes("exceeds") || lower.includes("maximum of")) {
    return {
      title: "Guest count exceeds capacity",
      message: raw || "Choose fewer guests than this stay allows.",
    }
  }

  if (
    lower.includes("minimum stay") ||
    lower.includes("check-in") ||
    lower.includes("check-out") ||
    lower.includes("invalid") && lower.includes("date")
  ) {
    return {
      title: "Invalid dates",
      message: raw || "Choose a check-out after check-in.",
    }
  }

  if (
    lower.includes("not available") ||
    lower.includes("date_conflict") ||
    lower.includes("conflict")
  ) {
    return {
      title: "Property unavailable",
      message: raw || "Those dates are no longer available.",
    }
  }

  if (lower.includes("host response window") || lower.includes("host_window_expired")) {
    return {
      title: "Request expired",
      message: raw || "The host response window ended. Send a new request if you still want these dates.",
    }
  }

  if (surface === "payment" || lower.includes("paystack") || lower.includes("payment")) {
    if (lower.includes("pending") || lower.includes("processing")) {
      return {
        title: "Payment verification pending",
        message: raw || "Paystack has not confirmed this payment yet. Do not start a second charge.",
      }
    }
    return {
      title: "Payment initialization failure",
      message: raw || "Payment could not be started. Your reservation was not marked confirmed.",
    }
  }

  if (surface === "request") {
    return {
      title: "Host request failed",
      message: raw || "The reservation request was not sent. No charge was created.",
    }
  }

  if (surface === "search") {
    return {
      title: "Search failed",
      message: raw || "Search could not be completed. Try again.",
    }
  }

  if (surface === "property") {
    return {
      title: "Couldn’t load stay",
      message: raw || "This listing could not be loaded.",
    }
  }

  return {
    title: "Unexpected error",
    message: raw || "Something went wrong. Try again.",
  }
}
