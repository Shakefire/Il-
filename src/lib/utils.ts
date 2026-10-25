export function formatNaira(amount?: number | string | null): string {
  if (amount === null || amount === undefined) {
    return "₦0";
  }
  const num = typeof amount === "number" ? amount : Number(amount);
  if (isNaN(num)) {
    return "₦0";
  }
  return "₦" + num.toLocaleString("en-NG");
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function calculateNights(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 1;
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  } catch {
    return 1;
  }
}

export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultDates(stayNights = 3): { checkIn: string; checkOut: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const checkIn = `${year}-${month}-${day}`;

  const outDate = new Date(today);
  outDate.setDate(today.getDate() + stayNights);
  const outYear = outDate.getFullYear();
  const outMonth = String(outDate.getMonth() + 1).padStart(2, "0");
  const outDay = String(outDate.getDate()).padStart(2, "0");
  const checkOut = `${outYear}-${outMonth}-${outDay}`;

  return { checkIn, checkOut };
}

/**
 * Calculates Paystack pass-through processing fee according to official Paystack ratio:
 * 1.5% + 100 NGN (100 NGN waived on micro-transactions under 2,500 NGN).
 * Dynamically computes the exact fee ratio without hardcoding a flat 2,000 NGN cap.
 */
export function calculatePaystackFee(subtotal: number): number {
  if (!subtotal || subtotal <= 0) return 0;
  if (subtotal < 2500) {
    return Math.ceil(subtotal / 0.985) - subtotal;
  }
  return Math.ceil((subtotal + 100) / 0.985) - subtotal;
}

/**
 * Masks a Nigerian bank account number for secure display.
 * e.g. "0123456789" -> "•••• •••• 6789"
 */
export function maskAccountNumber(acc?: string | null): string {
  if (!acc) return "—";
  const cleaned = acc.trim();
  if (cleaned.length < 4) return "••••";
  return `•••• •••• ${cleaned.slice(-4)}`;
}



