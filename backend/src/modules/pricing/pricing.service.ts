import { eq } from "drizzle-orm";
import { getDb, schema } from "../../db/client";

export const DEFAULT_COMMISSION_RATE = 0.10; // 10% platform commission

/**
 * Calculates Paystack pass-through processing fee according to official Paystack ratio:
 * 1.5% + 100 NGN (100 NGN waived on micro-transactions under 2,500 NGN),
 * strictly capped at 2,000 NGN maximum per domestic transaction.
 */
export function calculatePaystackFee(subtotal: number): number {
  if (!subtotal || subtotal <= 0) return 0;
  let fee = 0;
  if (subtotal < 2500) {
    fee = Math.ceil(subtotal / 0.985) - subtotal;
  } else {
    fee = Math.ceil((subtotal + 100) / 0.985) - subtotal;
  }
  return fee > 2000 ? 2000 : fee;
}

/**
 * Fetch the active platform commission rate from platform_settings table.
 */
export async function getPlatformCommissionRate(): Promise<number> {
  try {
    const db = getDb();
    const [settings] = await db
      .select({ pct: schema.platformSettings.defaultHostCommissionPct })
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.id, "default"))
      .limit(1);

    if (settings?.pct !== undefined && settings?.pct !== null) {
      return settings.pct / 100;
    }
  } catch (err) {
    console.warn("[Pricing] Could not load platform settings, using default commission 10%:", err);
  }
  return DEFAULT_COMMISSION_RATE;
}

export interface PricingBreakdown {
  hostBaseNightlyPrice: number;
  guestNightlyAccommodationPrice: number;
  numberOfNights: number;
  accommodationSubtotal: number;
  hostEarnings: number;
  platformCommission: number;
  commissionRate: number;
  paystackFee: number;
  totalGuestPayment: number;
  cleaningFee: 0;
  serviceFee: number; // For compatibility, equal to paystackFee
}

/**
 * Authoritative Pricing Calculation starting from Host's base nightly rate.
 * Formula:
 * - guestNightlyAccommodationPrice = Math.round(hostBaseNightlyPrice * (1 + commissionRate))
 * - accommodationSubtotal = guestNightlyAccommodationPrice * numberOfNights
 * - hostEarnings = hostBaseNightlyPrice * numberOfNights
 * - platformCommission = accommodationSubtotal - hostEarnings
 * - Paystack fee domestic pass-through
 */
export function calculateFromHostBase(
  hostBaseNightlyPrice: number,
  numberOfNights: number,
  commissionRate = DEFAULT_COMMISSION_RATE
): PricingBreakdown {
  const safeHostPrice = Math.max(0, Math.round(hostBaseNightlyPrice));
  const safeNights = Math.max(1, Math.round(numberOfNights));
  const guestNightlyPrice = Math.round(safeHostPrice * (1 + commissionRate));
  const accommodationSubtotal = guestNightlyPrice * safeNights;
  const hostEarnings = safeHostPrice * safeNights;
  const platformCommission = accommodationSubtotal - hostEarnings;
  const paystackFee = calculatePaystackFee(accommodationSubtotal);
  const totalGuestPayment = accommodationSubtotal + paystackFee;

  return {
    hostBaseNightlyPrice: safeHostPrice,
    guestNightlyAccommodationPrice: guestNightlyPrice,
    numberOfNights: safeNights,
    accommodationSubtotal,
    hostEarnings,
    platformCommission,
    commissionRate,
    paystackFee,
    totalGuestPayment,
    cleaningFee: 0,
    serviceFee: paystackFee,
  };
}

/**
 * Authoritative Pricing Calculation starting from Guest's nightly accommodation price.
 * Formula:
 * - hostBaseNightlyPrice = explicitHostBase || Math.round(guestNightlyAccommodationPrice / (1 + commissionRate))
 * - accommodationSubtotal = guestNightlyAccommodationPrice * numberOfNights
 * - hostEarnings = hostBaseNightlyPrice * numberOfNights
 * - platformCommission = accommodationSubtotal - hostEarnings
 */
export function calculateFromGuestPrice(
  guestNightlyAccommodationPrice: number,
  numberOfNights: number,
  commissionRate = DEFAULT_COMMISSION_RATE,
  explicitHostBase?: number
): PricingBreakdown {
  const safeGuestPrice = Math.max(0, Math.round(guestNightlyAccommodationPrice));
  const safeNights = Math.max(1, Math.round(numberOfNights));

  const hostBasePrice =
    explicitHostBase !== undefined && explicitHostBase > 0
      ? Math.round(explicitHostBase)
      : Math.round(safeGuestPrice / (1 + commissionRate));

  const accommodationSubtotal = safeGuestPrice * safeNights;
  const hostEarnings = hostBasePrice * safeNights;
  const platformCommission = accommodationSubtotal - hostEarnings;
  const paystackFee = calculatePaystackFee(accommodationSubtotal);
  const totalGuestPayment = accommodationSubtotal + paystackFee;

  return {
    hostBaseNightlyPrice: hostBasePrice,
    guestNightlyAccommodationPrice: safeGuestPrice,
    numberOfNights: safeNights,
    accommodationSubtotal,
    hostEarnings,
    platformCommission,
    commissionRate,
    paystackFee,
    totalGuestPayment,
    cleaningFee: 0,
    serviceFee: paystackFee,
  };
}
