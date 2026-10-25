"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  MapPin,
  Users,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/utils";

interface BookingItem {
  id: string;
  referenceCode: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  guestCount: number;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  accessToken: string;
  property?: {
    id: string;
    title: string;
    city: string;
    neighborhood: string;
    coverImage: string;
    slug: string;
  };
}

interface PrivateAccessDetails {
  bookingReference: string;
  exactAddress: string;
  unitNumber?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  checkInInstructions?: string;
  accessGateCode?: string;
}

function TripsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedBookingForAccess, setSelectedBookingForAccess] = useState<BookingItem | null>(null);
  const [accessDetails, setAccessDetails] = useState<PrivateAccessDetails | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Fast booking lookup states
  const [lookupRef, setLookupRef] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleLookupBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupRef.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const emailQuery = lookupEmail.trim() ? `?email=${encodeURIComponent(lookupEmail.trim())}` : "";
      const res = await fetch(`/api/bookings/${encodeURIComponent(lookupRef.trim())}${emailQuery}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking not found");
      if (data.booking) {
        const found = data.booking;
        setBookings((prev) => [found, ...prev.filter((b) => b.id !== found.id)]);
        try {
          const stored = JSON.parse(localStorage.getItem("ile_guest_bookings") || "[]");
          const merged = [found, ...stored.filter((b: any) => b.id !== found.id)];
          localStorage.setItem("ile_guest_bookings", JSON.stringify(merged));
        } catch {}
        handleOpenAccessModal(found);
      }
    } catch (err: any) {
      setLookupError(err.message || "Failed to locate booking");
    } finally {
      setLookupLoading(false);
    }
  };

  const paymentRef = searchParams.get("ref") || searchParams.get("reference") || searchParams.get("trxref");

  // Load stored guest bookings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ile_guest_bookings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBookings((prev) => {
            const map = new Map<string, BookingItem>();
            parsed.forEach((b: BookingItem) => map.set(b.id, b));
            prev.forEach((b: BookingItem) => map.set(b.id, b));
            return Array.from(map.values());
          });
          setLoadingBookings(false);
        }
      }
    } catch {}
  }, []);

  const loadBookings = useCallback(async () => {
    try {
      const res = await api.getUserBookings();
      if (res && Array.isArray(res.bookings)) {
        setBookings((prev) => {
          const map = new Map<string, BookingItem>();
          prev.forEach((b: BookingItem) => map.set(b.id, b));
          res.bookings.forEach((b: BookingItem) => map.set(b.id, b));
          return Array.from(map.values());
        });
        return res.bookings;
      }
    } catch (err) {
      console.warn("Notice: user bookings sync:", err);
    } finally {
      setLoadingBookings(false);
    }
    return [];
  }, []);

  // Check for Paystack redirect parameters and auto-verify
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");

    if (paymentRef && (paymentStatus === "success" || paymentStatus === "mock" || searchParams.has("trxref"))) {
      let isMounted = true;
      const verifyAndRefresh = async () => {
        try {
          const verifyRes = await api.verifyPayment(paymentRef);
          if (!isMounted) return;
          if (verifyRes && verifyRes.verified) {
            setPaymentNotice({
              type: "success",
              message: `Payment verified successfully (Ref: ${paymentRef})! Your stay is confirmed and access details are unlocked.`,
            });

            if (verifyRes.booking) {
              const confirmedB = verifyRes.booking;
              try {
                const stored = JSON.parse(localStorage.getItem("ile_guest_bookings") || "[]");
                const merged = [confirmedB, ...stored.filter((b: any) => b.id !== confirmedB.id)];
                localStorage.setItem("ile_guest_bookings", JSON.stringify(merged));
              } catch {}

              setBookings((prev) => [confirmedB, ...prev.filter((b) => b.id !== confirmedB.id)]);
              setLoadingBookings(false);

              if (confirmedB.privateDetails) {
                setAccessDetails(confirmedB.privateDetails);
              }
              setSelectedBookingForAccess(confirmedB);
            }

            await loadBookings();
          }
        } catch (err: any) {
          if (isMounted) {
            console.warn("Payment auto-verification notice:", err);
          }
        }
      };

      verifyAndRefresh();
      return () => {
        isMounted = false;
      };
    }
  }, [searchParams, loadBookings, paymentRef]);

  useEffect(() => {
    if (isAuthenticated) {
      loadBookings();
    } else {
      setLoadingBookings(false);
    }
  }, [isAuthenticated, loadBookings]);

  const handleOpenAccessModal = async (booking: BookingItem) => {
    setSelectedBookingForAccess(booking);
    setLoadingAccess(true);
    setAccessError(null);

    // If private details are already attached to the booking, load immediately
    if ((booking as any).privateDetails) {
      setAccessDetails((booking as any).privateDetails);
      setLoadingAccess(false);
      return;
    }

    setAccessDetails(null);

    try {
      const res = await api.getBookingContact(booking.id, booking.accessToken);
      setAccessDetails(res);
    } catch (err: any) {
      setAccessError(err.message || "Failed to load access details. Payment must be confirmed.");
    } finally {
      setLoadingAccess(false);
    }
  };

  if (isLoading || (loadingBookings && isAuthenticated)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
      </div>
    );
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingBookings = bookings.filter(
    (b) => b.checkOutDate >= todayStr && b.status !== "CANCELLED"
  );
  const pastBookings = bookings.filter(
    (b) => b.checkOutDate < todayStr || b.status === "CANCELLED"
  );

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Payment Verification Banner */}
        {paymentNotice && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in ${
              paymentNotice.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-red-50 border border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Paystack Payment Successful</h4>
                <p className="text-xs text-emerald-800">{paymentNotice.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaymentNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold p-1 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E5E0] pb-6">
          <div>
            <h1 className="text-3xl font-bold font-display text-[#171717]">My Trips</h1>
            <p className="text-sm text-[#6B6B67] mt-1">
              Manage your reservations, view check-in passes, and travel history.
            </p>
          </div>
          <Link
            href="/search"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-sm font-semibold transition-colors shadow-sm self-start sm:self-auto"
          >
            Explore new stays
          </Link>
        </div>

        {/* Empty State with Fast Lookup */}
        {bookings.length === 0 ? (
          <div className="bg-white border border-[#E7E5E0] rounded-2xl p-8 sm:p-10 text-center max-w-lg mx-auto space-y-6 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center mx-auto">
              <Calendar size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#171717]">Find Your Reservation &amp; Access Pass</h2>
              <p className="text-xs text-[#6B6B67] leading-relaxed mt-1">
                Completed a stay booking? Enter your booking reference (e.g. ILE-MVJLECF2...) to view your gate clearance pass and host contact details.
              </p>
            </div>

            <form onSubmit={handleLookupBooking} className="space-y-3 text-left">
              <div>
                <label className="block text-[11px] font-semibold text-[#171717] uppercase mb-1">
                  Booking Reference
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. ILE-MVJLECF2-0A8D57"
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value.trim().toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-mono uppercase focus:border-[#0B5D45] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171717] uppercase mb-1">
                  Guest Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="The email used during reservation"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value.trim())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-xs focus:border-[#0B5D45] focus:outline-none"
                />
              </div>
              {lookupError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {lookupError}
                </p>
              )}
              <button
                type="submit"
                disabled={lookupLoading || !lookupRef.trim()}
                className="w-full py-2.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {lookupLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Locating Reservation...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={14} />
                    <span>View Stay &amp; Access Pass</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-[#F2F0EB]">
              <Link
                href="/search"
                className="text-xs font-semibold text-[#0B5D45] hover:underline"
              >
                Browse &amp; explore new stays →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming Reservations */}
            <div>
              <h2 className="text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
                <span>Upcoming Stays</span>
                <span className="text-xs bg-[#0B5D45]/15 text-[#0B5D45] font-semibold px-2 py-0.5 rounded-full">
                  {upcomingBookings.length}
                </span>
              </h2>

              {upcomingBookings.length === 0 ? (
                <p className="text-sm text-[#8B8B86] italic bg-white p-6 rounded-xl border border-[#E7E5E0]">
                  You have no upcoming trips scheduled.
                </p>
              ) : (
                <div className="space-y-4">
                  {upcomingBookings.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white border border-[#E7E5E0] rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                    >
                      <div className="flex items-start gap-4 sm:gap-5">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-[#F0EFEB] relative flex-shrink-0">
                          {b.property?.coverImage ? (
                            <Image
                              src={b.property.coverImage}
                              alt={b.property.title || "Stay"}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-[#8B8B86]">
                              Ilé Stay
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                b.status === "CONFIRMED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {b.status}
                            </span>
                            <span className="text-xs font-mono text-[#8B8B86]">
                              #{b.referenceCode}
                            </span>
                          </div>

                          <h3 className="text-base sm:text-lg font-bold text-[#171717]">
                            {b.property?.title || "Reserved Property"}
                          </h3>

                          <p className="text-xs sm:text-sm text-[#6B6B67] flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#0B5D45]" />
                            <span>
                              {b.property?.neighborhood ? `${b.property.neighborhood}, ` : ""}
                              {b.property?.city || "Nigeria"}
                            </span>
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B6B67] pt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={13} />
                              <span>
                                {b.checkInDate} to {b.checkOutDate} ({b.numberOfNights} nights)
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Users size={13} />
                              <span>{b.guestCount} guests</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action CTA */}
                      <div className="w-full md:w-auto flex flex-col sm:flex-row md:flex-col items-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#F2F0EB]">
                        <p className="text-base font-bold text-[#171717] self-start md:self-end">
                          {formatNaira(b.totalAmount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenAccessModal(b)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-xs font-semibold transition-colors shadow-sm"
                        >
                          <KeyRound size={14} />
                          <span>View Access &amp; Gate Pass</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Reservations */}
            {pastBookings.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[#171717] mb-4">Past Stays</h2>
                <div className="space-y-3">
                  {pastBookings.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white border border-[#E7E5E0] rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-[#171717]">
                          {b.property?.title || `Stay #${b.referenceCode}`}
                        </p>
                        <p className="text-xs text-[#6B6B67]">
                          {b.checkInDate} — {b.checkOutDate} · {formatNaira(b.totalAmount)}
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 text-[#6B6B67]">
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Access Details Modal */}
        {selectedBookingForAccess && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => setSelectedBookingForAccess(null)}
                className="absolute right-5 top-5 p-1 rounded-full text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-100 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#171717]">Gate Pass &amp; Check-In</h3>
                  <p className="text-xs font-mono text-[#6B6B67]">
                    Ref: #{selectedBookingForAccess.referenceCode}
                  </p>
                </div>
              </div>

              {loadingAccess ? (
                <div className="py-8 text-center text-sm text-[#8B8B86] flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
                  <span>Retrieving secure property clearance...</span>
                </div>
              ) : accessError ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle size={16} />
                    <span>Access Quarantined</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">{accessError}</p>
                </div>
              ) : accessDetails ? (
                <div className="space-y-4 text-sm divide-y divide-[#F2F0EB]">
                  <div className="pt-2 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                      Exact Property Address
                    </span>
                    <p className="text-base font-semibold text-[#171717]">
                      {accessDetails.exactAddress}
                    </p>
                    {accessDetails.unitNumber && (
                      <p className="text-xs text-[#6B6B67]">Unit / Apt: {accessDetails.unitNumber}</p>
                    )}
                  </div>

                  {accessDetails.accessGateCode && (
                    <div className="pt-3 space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                        Estate Gate Clearance Pass
                      </span>
                      <div className="p-3 bg-[#EDF3F0] border border-[#0B5D45]/20 rounded-xl flex items-center justify-between">
                        <span className="font-mono text-lg font-bold text-[#0B5D45] tracking-wider">
                          {accessDetails.accessGateCode}
                        </span>
                        <span className="text-xs text-[#0B5D45] font-medium">Show at security gate</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                      Host Contact on Arrival
                    </span>
                    <p className="font-semibold text-[#171717]">{accessDetails.contactName}</p>
                    <p className="text-xs text-[#6B6B67] flex items-center gap-1.5">
                      <span>Phone:</span>
                      <a href={`tel:${accessDetails.contactPhone}`} className="text-[#0B5D45] font-semibold underline">
                        {accessDetails.contactPhone}
                      </a>
                    </p>
                  </div>

                  {accessDetails.checkInInstructions && (
                    <div className="pt-3 space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8B86]">
                        Check-in Instructions
                      </span>
                      <p className="text-xs text-[#4A4A45] leading-relaxed whitespace-pre-wrap">
                        {accessDetails.checkInInstructions}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBookingForAccess(null)}
                  className="w-full py-2.5 rounded-xl border border-[#E7E5E0] bg-[#F7F6F2] hover:bg-[#EFECE6] text-sm font-semibold text-[#171717] transition-colors"
                >
                  Close Pass
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAF8]">
          <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
        </div>
      }
    >
      <TripsPageContent />
    </Suspense>
  );
}
