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

