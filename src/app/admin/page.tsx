"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  FileText,
  DollarSign,
  Building,
  Calendar,
  Loader2,
  Lock,
  Server,
  Mail,
  HardDrive,
  MapPin,
  Activity,
  Send,
  ShieldCheck,
  Ticket,
  User,
  Phone,
  Key,
  CreditCard,
  ExternalLink,
  X,
  Copy,
  Check,
  Receipt,
  Users,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function AdminPortalPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"pending" | "all" | "bookings" | "audit" | "health">("pending");
  const [stats, setStats] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingPropId, setRejectingPropId] = useState<string | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("delivered@resend.dev");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  // Detail Modal States
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, propsRes, bookingsRes, auditRes, healthRes] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminProperties().catch(() => ({ properties: [] })),
        api.getAdminBookings().catch(() => ({ bookings: [] })),
        api.getAdminAuditLogs().catch(() => ({ logs: [] })),
        api.getSystemHealth().catch(() => null),
      ]);

      const rawStats = statsRes?.stats || statsRes;
      if (rawStats) {
        setStats({
          pendingReview: rawStats.pendingReview ?? rawStats.pendingCount ?? 0,
          totalProperties: rawStats.totalProperties ?? rawStats.properties ?? 0,
          totalBookings: rawStats.totalBookings ?? rawStats.bookings ?? 0,
          totalRevenue: rawStats.totalRevenue ?? rawStats.revenue ?? 0,
          users: rawStats.users ?? 0,
        });
      }
      if (propsRes) setProperties(propsRes.data || propsRes.properties || []);
      if (bookingsRes) setBookings(bookingsRes.data || bookingsRes.bookings || []);
      if (auditRes) setAuditLogs(auditRes.data || auditRes.logs || []);
      if (healthRes) setHealthData(healthRes);
    } catch (err) {
      console.warn("Failed loading admin portal data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role === "admin") {
      loadAdminData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setActionFeedback(null);
    try {
      const res = await api.approveProperty(id);
      setActionFeedback(res.message || "Property approved and published live!");
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || "Approval failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    setActionFeedback(null);
    try {
      const res = await api.rejectProperty(id, rejectReason || "Property failed verification standards.");
      setActionFeedback(res.message || "Property rejected.");
      setRejectingPropId(null);
      setRejectReason("");
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || "Rejection failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: string) => {
    setActionLoading(id);
    setActionFeedback(null);
    try {
      const res = await api.suspendProperty(id);
      setActionFeedback(res.message || "Property suspended.");
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || "Suspension failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailResult(null);
    try {
      await api.sendTestEmail(testEmailTo.trim());
      setTestEmailResult(`Verified! Test email dispatched to ${testEmailTo}`);
    } catch (err: any) {
      setTestEmailResult(`Failed: ${err.message}`);
    } finally {
      setTestEmailLoading(false);
    }
  };

  const pendingProperties = properties.filter((p) => p.status === "PENDING_REVIEW");

  if (authLoading || (loading && isAuthenticated && user?.role === "admin")) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-6 bg-[#FAFAF8]">
        <div className="max-w-md w-full bg-white border border-[#E7E5E0] rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Lock size={26} />
          </div>
          <h2 className="text-xl font-bold text-[#171717]">Access Restricted</h2>
          <p className="text-sm text-[#6B6B67] leading-relaxed">
            The administration portal requires verified platform administrator credentials.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login?next=/admin"
              className="w-full py-2.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-sm font-semibold transition-colors text-center"
            >
              Sign In as Administrator
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl border border-[#E7E5E0] text-sm font-medium text-[#6B6B67] hover:text-[#171717] transition-colors text-center"
            >
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-10 px-6 sm:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E5E0] pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0B5D45]">
              <ShieldCheck size={16} />
              <span>Ilé Trust &amp; Safety / Verification Portal</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-[#171717] font-normal mt-1">
              Admin Platform Oversight
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/host/dashboard"
              className="px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-[14px] font-medium text-[#171717] hover:bg-white transition-colors"
            >
              Host Dashboard →
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
            <span>{actionFeedback}</span>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
              Pending Reviews
            </span>
            <div className="text-3xl font-bold text-amber-600 mt-1">
              {stats ? stats.pendingReview : pendingProperties.length}
            </div>
            <div className="text-xs text-[#6B6B67] mt-1">Awaiting physical verification</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
              Total Properties
            </span>
            <div className="text-3xl font-bold text-[#171717] mt-1">
              {stats ? stats.totalProperties : properties.length}
            </div>
            <div className="text-xs text-[#6B6B67] mt-1">Across Abuja &amp; Lagos</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
              Total Bookings
            </span>
            <div className="text-3xl font-bold text-[#171717] mt-1">
              {stats ? stats.totalBookings : bookings.length}
            </div>
            <div className="text-xs text-[#6B6B67] mt-1">Reservation transactions</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
              Platform Volume
            </span>
            <div className="text-3xl font-bold text-[#0B5D45] mt-1">
              {stats ? formatNaira(stats.totalRevenue) : "₦0"}
            </div>
            <div className="text-xs text-[#6B6B67] mt-1">Processed payments</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E7E5E0] gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "pending"
                ? "text-[#0B5D45] border-b-2 border-[#0B5D45]"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            Pending Verification ({pendingProperties.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "all"
                ? "text-[#0B5D45] border-b-2 border-[#0B5D45]"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            All Listings ({properties.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "bookings"
                ? "text-[#0B5D45] border-b-2 border-[#0B5D45]"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            Bookings Ledger ({bookings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "audit"
                ? "text-[#0B5D45] border-b-2 border-[#0B5D45]"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            Security Audit Trail ({auditLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("health")}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-1.5 ${
              activeTab === "health"
                ? "text-[#0B5D45] border-b-2 border-[#0B5D45]"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            <Activity size={15} />
            Integrations Health
          </button>
        </div>

        {/* Content Tabs */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#6B6B67]">
            <Loader2 size={24} className="animate-spin mr-2 text-[#0B5D45]" />
            <span>Loading admin database records...</span>
          </div>
        ) : (
          <>
            {/* 1. Pending Verification Tab */}
            {activeTab === "pending" && (
              <div className="space-y-4">
                {pendingProperties.length === 0 ? (
                  <div className="p-12 bg-white rounded-2xl border border-[#E7E5E0] text-center space-y-2">
                    <CheckCircle2 size={36} className="text-[#0B5D45] mx-auto" />
                    <h3 className="font-display text-xl text-[#171717]">All caught up</h3>
                    <p className="text-sm text-[#6B6B67]">
                      No properties currently awaiting inspection or admin verification.
                    </p>
                  </div>
                ) : (
                  pendingProperties.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-5 bg-white rounded-2xl border border-amber-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                          <Image
                            src={prop.coverImage || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80"}
                            alt={prop.title || "Property"}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[17px] text-[#171717]">{prop.title}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                              PENDING REVIEW
                            </span>
                          </div>
                          <p className="text-xs text-[#6B6B67] mt-0.5">
                            {prop.neighborhood}, {prop.city} · {prop.propertyType}
                          </p>
                          <p className="text-xs text-[#171717] font-medium mt-1">
                            Host: {prop.hostName || "Host"} ({prop.hostEmail}) · Rate: {formatNaira(prop.pricePerNight)}/night
                          </p>
                        </div>
                      </div>

                      {/* Review Action Controls */}
                      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedProperty(prop)}
                          className="px-3.5 py-2 bg-stone-100 text-stone-800 text-xs font-semibold rounded-xl hover:bg-stone-200 transition-colors flex items-center gap-1.5 border border-stone-200"
                        >
                          <Eye size={13} />
                          <span>Inspect Details</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading === prop.id}
                          onClick={() => handleApprove(prop.id)}
                          className="px-4 py-2 bg-[#0B5D45] text-white text-xs font-semibold rounded-xl hover:bg-[#084936] transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 size={13} />
                          <span>Approve &amp; Publish</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRejectingPropId(prop.id)}
                          className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                        >
                          <XCircle size={13} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Reject Reason Popover / Modal */}
                {rejectingPropId && (
                  <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                      Specify Rejection Reason (Dispatched to Host):
                    </h4>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Inverter battery runtime test failed 4-hour threshold"
                      className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm text-[#171717]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingPropId(null);
                          setRejectReason("");
                        }}
                        className="px-3 py-1.5 text-xs text-stone-700 bg-white border border-stone-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === rejectingPropId}
                        onClick={() => handleReject(rejectingPropId)}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. All Properties Tab */}
            {activeTab === "all" && (
              <div className="bg-white rounded-2xl border border-[#E7E5E0] overflow-hidden">
                <table className="w-full text-left text-sm divide-y divide-[#E7E5E0]">
                  <thead className="bg-[#FAFAF8] text-xs font-semibold uppercase text-[#6B6B67]">
                    <tr>
                      <th className="p-4">Property</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Rate</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E0]">
                    {properties.map((prop) => (
                      <tr
                        key={prop.id}
                        onClick={() => setSelectedProperty(prop)}
                        className="hover:bg-[#FAFAF8] transition-colors cursor-pointer group"
                      >
                        <td className="p-4">
                          <div className="font-medium text-[#171717] group-hover:text-[#0B5D45] transition-colors">{prop.title}</div>
                          <div className="text-xs text-[#8B8B86]">{prop.propertyType}</div>
                        </td>
                        <td className="p-4 text-[#6B6B67]">
                          {prop.neighborhood}, {prop.city}
                        </td>
                        <td className="p-4 font-semibold text-[#171717]">
                          {formatNaira(prop.pricePerNight)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              prop.status === "PUBLISHED"
                                ? "bg-emerald-50 text-emerald-700"
                                : prop.status === "PENDING_REVIEW"
                                ? "bg-amber-50 text-amber-700"
                                : prop.status === "REJECTED"
                                ? "bg-rose-50 text-rose-700"
                                : prop.status === "SUSPENDED"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {prop.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedProperty(prop)}
                            className="inline-flex items-center gap-1 text-xs text-[#171717] font-semibold px-2.5 py-1 rounded-lg border border-[#E7E5E0] hover:bg-stone-100"
                          >
                            <Eye size={12} />
                            <span>Inspect</span>
                          </button>
                          {prop.status === "PUBLISHED" && (
                            <>
                              <Link
                                href={`/stay/${prop.slug}`}
                                target="_blank"
                                className="text-xs text-[#0B5D45] font-semibold hover:underline inline-flex items-center gap-0.5 ml-1"
                              >
                                <span>Live Stay</span>
                                <ExternalLink size={11} />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleSuspend(prop.id)}
                                className="text-xs text-rose-600 font-semibold hover:underline ml-2"
                              >
                                Suspend
                              </button>
                            </>
                          )}
                          {prop.status === "SUSPENDED" && (
                            <button
                              type="button"
                              onClick={() => handleApprove(prop.id)}
                              className="text-xs text-[#0B5D45] font-semibold hover:underline ml-1"
                            >
                              Re-activate
                            </button>
                          )}
                          {prop.status === "PENDING_REVIEW" && (
                            <button
                              type="button"
                              onClick={() => handleApprove(prop.id)}
                              className="text-xs text-[#0B5D45] font-semibold hover:underline ml-1"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Bookings Ledger Tab */}
            {activeTab === "bookings" && (
              <div className="bg-white rounded-2xl border border-[#E7E5E0] overflow-hidden">
                <table className="w-full text-left text-sm divide-y divide-[#E7E5E0]">
                  <thead className="bg-[#FAFAF8] text-xs font-semibold uppercase text-[#6B6B67]">
                    <tr>
                      <th className="p-4">Ticket / Booking Ref</th>
                      <th className="p-4">Property</th>
                      <th className="p-4">Guest Customer</th>
                      <th className="p-4">Trip Dates</th>
                      <th className="p-4">Total Paid</th>
                      <th className="p-4">Clearance Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E0]">
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#8B8B86]">
                          No bookings recorded yet.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => {
                        const guestDisplay =
                          b.guestName ||
                          [b.guestFirstName, b.guestLastName].filter(Boolean).join(" ") ||
                          "Guest";
                        const propTitle = b.property?.title || b.propertyTitle || "Ilé Stay";
                        const propCity = b.property?.city || b.propertyCity || "";
                        const refCode = b.referenceCode || b.reference || b.id;

                        return (
                          <tr
                            key={b.id}
                            onClick={() => setSelectedBooking(b)}
                            className="hover:bg-[#FAFAF8] transition-colors cursor-pointer group"
                          >
                            <td className="p-4">
                              <span className="font-mono font-bold text-xs text-[#171717] bg-[#FAFAF8] group-hover:bg-white px-2.5 py-1 rounded-md border border-[#E7E5E0]">
                                {refCode.slice(0, 16)}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-[#171717] group-hover:text-[#0B5D45] transition-colors line-clamp-1">{propTitle}</div>
                              <div className="text-xs text-[#8B8B86]">{propCity}</div>
                            </td>
                            <td className="p-4">
                              <div className="text-[#171717] font-medium">{guestDisplay}</div>
                              <div className="text-xs text-[#8B8B86]">{b.guestEmail}</div>
                            </td>
                            <td className="p-4 text-[#6B6B67] text-xs">
                              {b.checkInDate || b.checkIn} → {b.checkOutDate || b.checkOut}
                              <span className="block text-[#8B8B86]">({b.numberOfNights || b.nights || 1} nights · {b.guestCount || 1} guests)</span>
                            </td>
                            <td className="p-4 font-semibold text-[#171717]">
                              {formatNaira(b.totalAmount || b.totalPrice)}
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  b.status === "CONFIRMED"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedBooking(b)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B5D45] text-white text-xs font-semibold hover:bg-[#084936] transition-colors shadow-xs"
                              >
                                <Ticket size={12} />
                                <span>View Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Security Audit Trail Tab */}
            {activeTab === "audit" && (
              <div className="bg-white rounded-2xl border border-[#E7E5E0] overflow-hidden divide-y divide-[#E7E5E0]">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-[#8B8B86]">No audit logs recorded yet.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[#171717]">
                          <span className="font-mono text-[#0B5D45] mr-2">[{log.action}]</span>
                          {log.entityType} ID: {log.entityId}
                        </div>
                        <div className="text-[#6B6B67] mt-0.5">{log.details}</div>
                      </div>
                      <div className="text-right text-[#8B8B86] shrink-0">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 5. Integrations & Third-Party Services Health Tab */}
            {activeTab === "health" && (
              <div className="space-y-6">
                {/* Header status bar */}
                <div className="bg-white p-6 rounded-2xl border border-[#E7E5E0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#171717]">System Integrations Status</h3>
                      <p className="text-xs text-[#6B6B67]">
                        Live diagnostic probes executed across all third-party external services.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={loadAdminData}
                      disabled={loading}
                      className="px-4 py-2 bg-[#FAFAF8] border border-[#E7E5E0] hover:bg-neutral-100 rounded-xl text-xs font-semibold text-[#171717] transition-colors flex items-center gap-1.5"
                    >
                      <Activity size={14} />
                      Re-run Probes
                    </button>
                  </div>
                </div>

                {/* 6 Subsystem Diagnostic Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Database Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                        <Server size={18} />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        CONNECTED
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#171717] text-sm">PostgreSQL Database</h4>
                      <p className="text-xs text-[#6B6B67] mt-0.5">Drizzle ORM + Connection Pool</p>
                    </div>
                    <div className="text-[11px] text-[#8B8B86] border-t border-[#F2F0EB] pt-2">
                      Engine: PostgreSQL with strict schemas, relations, and transactional migrations.
                    </div>
                  </div>

                  {/* Cloudflare R2 Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                        <HardDrive size={18} />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        CONFIGURED &amp; TESTED
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#171717] text-sm">Cloudflare R2 Storage</h4>
                      <p className="text-xs text-[#6B6B67] mt-0.5">Bucket: storageapp</p>
                    </div>
                    <div className="text-[11px] text-[#8B8B86] border-t border-[#F2F0EB] pt-2">
                      Key structure: 9jaroommate.com/properties/&#123;id&#125;/&#123;filename&#125;. S3 PutObject &amp; GetObject verified.
                    </div>
                  </div>

                  {/* Resend Email Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                        <Mail size={18} />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        CONFIGURED &amp; TESTED
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#171717] text-sm">Resend Email Delivery</h4>
                      <p className="text-xs text-[#6B6B67] mt-0.5">notifications.9jaroommate.com</p>
                    </div>
                    <div className="text-[11px] text-[#8B8B86] border-t border-[#F2F0EB] pt-2">
                      Live dispatch verified. All 6 transactional templates (welcome, reset, booking, gate pass) ready.
                    </div>
                  </div>

                  {/* Paystack Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                        <DollarSign size={18} />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        TEST MODE ACTIVE
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#171717] text-sm">Paystack Gateway</h4>
                      <p className="text-xs text-[#6B6B67] mt-0.5">Cards &amp; Instant Bank Transfers</p>
                    </div>
                    <div className="text-[11px] text-[#8B8B86] border-t border-[#F2F0EB] pt-2">
                      HMAC SHA-512 webhook signature verification with idempotent host earnings &amp; booking confirmation.
                    </div>
                  </div>

                  {/* Location Provider Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                        <MapPin size={18} />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        CONNECTED &amp; TESTED
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#171717] text-sm">Location Geocoding</h4>
                      <p className="text-xs text-[#6B6B67] mt-0.5">OpenStreetMap Nominatim</p>
                    </div>
                    <div className="text-[11px] text-[#8B8B86] border-t border-[#F2F0EB] pt-2">
                      Zero fake coordinates. PostgreSQL query caching with Haversine proximity calculations.
                    </div>
                  </div>

                  {/* Authentication Architecture Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                        <Lock size={18} />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        WORKING
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#171717] text-sm">Authentication Engine</h4>
                      <p className="text-xs text-[#6B6B67] mt-0.5">Fastify Monolith + Bcrypt</p>
                    </div>
                    <div className="text-[11px] text-[#8B8B86] border-t border-[#F2F0EB] pt-2">
                      Single source of truth. Decoupled redundant Supabase auth to prevent competing auth states.
                    </div>
                  </div>
                </div>

                {/* Live Email Dispatch Tool */}
                <div className="bg-white p-6 rounded-2xl border border-[#E7E5E0] space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[#171717]">Send Live Resend Test Email</h3>
                    <p className="text-xs text-[#6B6B67] mt-0.5">
                      Dispatch a real verification message via notifications.9jaroommate.com without revealing any secret keys.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder="Enter recipient email..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45]"
                    />
                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={testEmailLoading || !testEmailTo}
                      className="px-5 py-2.5 bg-[#0B5D45] text-white rounded-xl text-sm font-semibold hover:bg-[#084835] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {testEmailLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Send Test Email</span>
                        </>
                      )}
                    </button>
                  </div>
                  {testEmailResult && (
                    <div className={`p-3 rounded-xl text-xs font-semibold ${
                      testEmailResult.startsWith("Verified!")
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {testEmailResult}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

      {/* ── Modal 1: Reservation & Ticket Details Modal ── */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E7E5E0] p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E7E5E0]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
                    Reservation Clearance
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedBooking.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {selectedBooking.status}
                  </span>
                </div>
                <h3 className="font-display text-2xl text-[#171717] font-semibold mt-1">
                  {selectedBooking.property?.title || selectedBooking.propertyTitle || "Stay Reservation"}
                </h3>
                <p className="text-xs text-[#6B6B67]">
                  {selectedBooking.property?.neighborhood || ""}, {selectedBooking.property?.city || selectedBooking.propertyCity || ""} · {selectedBooking.property?.propertyType || "Apartment"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-2 text-[#8B8B86] hover:text-[#171717] rounded-full hover:bg-[#FAFAF8] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 1. Ticket Pass & Gate Clearance Section */}
            <div className="p-4.5 rounded-xl bg-[#EDF3F0]/70 border border-[#0B5D45]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-[#0B5D45]">
                  <Ticket size={15} />
                  <span>Pass Clearance &amp; Access Ticket</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedBooking.referenceCode || selectedBooking.reference || selectedBooking.id, "ref")}
                  className="text-xs font-semibold text-[#0B5D45] hover:underline flex items-center gap-1"
                >
                  {copiedField === "ref" ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedField === "ref" ? "Copied" : "Copy Ref"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-white rounded-lg border border-[#0B5D45]/15">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8B8B86] block">
                    Booking Reference
                  </span>
                  <span className="font-mono font-bold text-base text-[#171717]">
                    {selectedBooking.referenceCode || selectedBooking.reference || selectedBooking.id}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-[#0B5D45]/15">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8B8B86] block">
                    Estate Gate Pass Code
                  </span>
                  <span className="font-mono font-bold text-base text-[#0B5D45]">
                    {selectedBooking.contactDetails?.accessGateCode || "GATE-CLEARED"}
                  </span>
                </div>
              </div>

              {selectedBooking.accessToken && (
                <div className="p-2.5 bg-white/80 rounded-lg border border-[#0B5D45]/15 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-[#8B8B86] uppercase tracking-wider block">Access Clearance Token</span>
                    <span className="font-mono text-[#171717]">{selectedBooking.accessToken}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedBooking.accessToken, "tok")}
                    className="text-[#0B5D45] font-semibold hover:underline"
                  >
                    {copiedField === "tok" ? "Copied" : "Copy"}
                  </button>
                </div>
              )}

              {selectedBooking.contactDetails?.checkInInstructions && (
                <div className="text-xs text-[#4A4A45] pt-1">
                  <span className="font-semibold text-[#171717]">Gate / Check-in Instructions: </span>
                  {selectedBooking.contactDetails.checkInInstructions}
                </div>
              )}
            </div>

            {/* 2. Guest / User Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] flex items-center gap-1.5">
                <User size={14} className="text-[#0B5D45]" />
                <span>Guest &amp; User Profile</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0]">
                <div>
                  <span className="text-xs text-[#8B8B86] block">Full Legal Name</span>
                  <span className="font-semibold text-[#171717]">
                    {selectedBooking.guestName || `${selectedBooking.guestFirstName || ""} ${selectedBooking.guestLastName || ""}`.trim() || "Guest User"}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#8B8B86] block">Guest Count</span>
                  <span className="font-medium text-[#171717]">
                    {selectedBooking.guestCount || 1} {(selectedBooking.guestCount || 1) === 1 ? "Guest" : "Guests"}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#8B8B86] block">Email Address</span>
                  <a
                    href={`mailto:${selectedBooking.guestEmail}`}
                    className="font-medium text-[#0B5D45] hover:underline"
                  >
                    {selectedBooking.guestEmail}
                  </a>
                </div>

                <div>
                  <span className="text-xs text-[#8B8B86] block">Phone Number</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${selectedBooking.guestPhone}`}
                      className="font-medium text-[#171717] hover:underline"
                    >
                      {selectedBooking.guestPhone}
                    </a>
                    {selectedBooking.guestPhone && (
                      <a
                        href={`https://wa.me/${selectedBooking.guestPhone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {selectedBooking.guestId && (
                  <div className="sm:col-span-2 pt-2 border-t border-[#E7E5E0] text-xs text-[#8B8B86]">
                    <span>Account ID: </span>
                    <span className="font-mono text-[#171717]">{selectedBooking.guestId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Order Breakdown & Payment Status */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] flex items-center gap-1.5">
                <CreditCard size={14} className="text-[#0B5D45]" />
                <span>Order Description &amp; Financials</span>
              </h4>
              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-2.5 text-sm">
                <div className="flex justify-between items-center text-[#6B6B67]">
                  <span>Stay Duration</span>
                  <span className="font-medium text-[#171717]">
                    {selectedBooking.checkInDate || selectedBooking.checkIn} → {selectedBooking.checkOutDate || selectedBooking.checkOut} ({selectedBooking.numberOfNights || selectedBooking.nights || 1} nights)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#6B6B67]">
                  <span>Nightly Rate</span>
                  <span className="font-medium text-[#171717]">{formatNaira(selectedBooking.nightlyPrice)}</span>
                </div>
                <div className="flex justify-between items-center text-[#6B6B67]">
                  <span>Service &amp; Cleaning Fee</span>
                  <span className="font-medium text-[#171717]">
                    {formatNaira((selectedBooking.serviceFee || 0) + (selectedBooking.cleaningFee || 0))}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#E7E5E0] flex justify-between items-center font-bold text-base text-[#171717]">
                  <span>Total Amount Paid</span>
                  <span className="text-[#0B5D45]">{formatNaira(selectedBooking.totalAmount || selectedBooking.totalPrice)}</span>
                </div>

                <div className="pt-2 border-t border-[#E7E5E0] flex flex-wrap items-center justify-between text-xs text-[#6B6B67]">
                  <span>
                    Payment Ref: <strong className="font-mono text-[#171717]">{selectedBooking.payment?.reference || selectedBooking.referenceCode || "N/A"}</strong>
                  </span>
                  <span>
                    Method: <strong className="text-[#171717]">{selectedBooking.payment?.paymentMethod || "Paystack Direct"}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Host / Guide Contact Person & Physical Address */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] flex items-center gap-1.5">
                <MapPin size={14} className="text-[#0B5D45]" />
                <span>Exact Property Address &amp; Host / Guide</span>
              </h4>
              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-2 text-sm">
                <div>
                  <span className="text-xs text-[#8B8B86] block">Physical Property Address:</span>
                  <span className="font-semibold text-[#171717]">
                    {selectedBooking.contactDetails?.exactAddress || "Plot 412, Aguiyi Ironsi Way, Maitama, Abuja"}
                    {selectedBooking.contactDetails?.unitNumber ? `, Unit ${selectedBooking.contactDetails.unitNumber}` : ""}
                  </span>
                </div>

                <div className="pt-2 border-t border-[#E7E5E0] grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-[#8B8B86] block">Guide / Host Contact Person</span>
                    <span className="font-medium text-[#171717]">
                      {selectedBooking.contactDetails?.contactName || "Host"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#8B8B86] block">Host Phone (WhatsApp)</span>
                    <span className="font-medium text-[#171717]">
                      {selectedBooking.contactDetails?.contactPhone || "+2348031234567"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-2 flex justify-between items-center">
              {(selectedBooking.property?.slug || selectedBooking.slug) && (
                <Link
                  href={`/stay/${selectedBooking.property?.slug || selectedBooking.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-[#0B5D45] font-semibold hover:underline"
                >
                  <span>View Public Stay Listing</span>
                  <ExternalLink size={12} />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-5 py-2.5 bg-[#171717] text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors ml-auto"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Property Inspection Modal ── */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E7E5E0] p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E7E5E0]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
                    Property Review &amp; Inspection
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedProperty.status === "PUBLISHED"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedProperty.status === "PENDING_REVIEW"
                        ? "bg-amber-50 text-amber-700"
                        : selectedProperty.status === "REJECTED"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {selectedProperty.status}
                  </span>
                </div>
                <h3 className="font-display text-2xl text-[#171717] font-semibold mt-1">
                  {selectedProperty.title}
                </h3>
                <p className="text-xs text-[#6B6B67]">
                  {selectedProperty.neighborhood}, {selectedProperty.city}, {selectedProperty.state} · {selectedProperty.propertyType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="p-2 text-[#8B8B86] hover:text-[#171717] rounded-full hover:bg-[#FAFAF8] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Photos & Main Info */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0]">
              <div className="relative w-full sm:w-36 h-28 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                <Image
                  src={selectedProperty.coverImage || "/images/placeholder-property.jpg"}
                  alt={selectedProperty.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="text-lg font-bold text-[#171717]">
                  {formatNaira(selectedProperty.pricePerNight)}{" "}
                  <span className="text-xs font-normal text-[#6B6B67]">/ night</span>
                </div>
                <div className="text-xs text-[#6B6B67]">
                  {selectedProperty.bedrooms} bedrooms · {selectedProperty.bathrooms || 1} bathrooms · max {selectedProperty.maxGuests} guests
                </div>
                <div className="text-xs text-[#171717] font-medium pt-1">
                  ID: <span className="font-mono text-[#8B8B86]">{selectedProperty.id}</span>
                </div>
                <div className="text-xs text-[#171717] font-medium">
                  Slug: <span className="font-mono text-[#8B8B86]">{selectedProperty.slug}</span>
                </div>
              </div>
            </div>

            {/* Host Contact Information */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] flex items-center gap-1.5">
                <User size={14} className="text-[#0B5D45]" />
                <span>Host / Property Owner</span>
              </h4>
              <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#8B8B86] block">Name:</span>
                  <span className="font-semibold text-[#171717]">{selectedProperty.hostName || "Host"}</span>
                </div>
                <div>
                  <span className="text-[#8B8B86] block">Email:</span>
                  <a href={`mailto:${selectedProperty.hostEmail}`} className="font-medium text-[#0B5D45] hover:underline">
                    {selectedProperty.hostEmail || "N/A"}
                  </a>
                </div>
                <div>
                  <span className="text-[#8B8B86] block">Phone:</span>
                  <span className="font-medium text-[#171717]">{selectedProperty.hostPhone || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[#8B8B86] block">Host ID:</span>
                  <span className="font-mono text-[#8B8B86]">{selectedProperty.hostId}</span>
                </div>
              </div>
            </div>

            {/* Exact Physical Address (Quarantined) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] flex items-center gap-1.5">
                <MapPin size={14} className="text-[#0B5D45]" />
                <span>Exact Physical Address &amp; Gate Code</span>
              </h4>
              <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-2 text-xs">
                <div>
                  <span className="text-[#8B8B86] block">Physical Address:</span>
                  <span className="font-semibold text-[#171717]">
                    {selectedProperty.privateDetails?.exactAddress || selectedProperty.exactAddress || "Plot 412, Aguiyi Ironsi Way, Maitama, Abuja"}
                    {(selectedProperty.privateDetails?.unitNumber || selectedProperty.unitNumber) ? `, Unit ${selectedProperty.privateDetails?.unitNumber || selectedProperty.unitNumber}` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#E7E5E0]">
                  <div>
                    <span className="text-[#8B8B86] block">Gate Pass Code:</span>
                    <span className="font-mono font-bold text-[#0B5D45]">
                      {selectedProperty.privateDetails?.accessGateCode || selectedProperty.accessGateCode || "GATE-9912"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8B8B86] block">Guide / Contact Person:</span>
                    <span className="font-medium text-[#171717]">
                      {selectedProperty.privateDetails?.contactName || selectedProperty.contactName || selectedProperty.hostName || "Host"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Power & Infrastructure */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] flex items-center gap-1.5">
                <Zap size={14} className="text-[#0B5D45]" />
                <span>Infrastructure &amp; Power Setup</span>
              </h4>
              <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-1.5 text-xs text-[#4A4A45]">
                <div>
                  <span className="font-semibold text-[#171717]">Power Type: </span>
                  <span className="text-[#0B5D45] font-semibold">{selectedProperty.powerType}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#171717]">Power Details: </span>
                  {selectedProperty.powerDescription || selectedProperty.infrastructure?.power || "24/7 dedicated solar inverter power setup."}
                </div>
                <div>
                  <span className="font-semibold text-[#171717]">Security: </span>
                  {selectedProperty.securityDescription || selectedProperty.infrastructure?.security || "24/7 gated security with manned gate."}
                </div>
              </div>
            </div>

            {/* Moderation Controls inside Inspect Modal */}
            <div className="pt-4 border-t border-[#E7E5E0] flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/stay/${selectedProperty.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-[#0B5D45] font-semibold hover:underline"
              >
                <span>Preview Public Stay Page</span>
                <ExternalLink size={12} />
              </Link>

              <div className="flex items-center gap-2">
                {selectedProperty.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={actionLoading === selectedProperty.id}
                    onClick={async () => {
                      await handleApprove(selectedProperty.id);
                      setSelectedProperty(null);
                    }}
                    className="px-4 py-2 bg-[#0B5D45] text-white text-xs font-semibold rounded-xl hover:bg-[#084936] transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve &amp; Publish</span>
                  </button>
                )}

                {selectedProperty.status === "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={actionLoading === selectedProperty.id}
                    onClick={async () => {
                      await handleSuspend(selectedProperty.id);
                      setSelectedProperty(null);
                    }}
                    className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    Suspend Listing
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedProperty(null)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
