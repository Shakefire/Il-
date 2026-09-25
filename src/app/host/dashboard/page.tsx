"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Home,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Eye,
  Send,
  Loader2,
  DollarSign,
  Calendar,
  Lock,
  ArrowRight,
  ShieldCheck,
  Building,
  User,
  CreditCard,
  Trash2,
  CalendarCheck,
  CalendarX,
  TrendingUp,
  Layers,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface HostProperty {
  id: string;
  slug: string;
  title: string;
  propertyType: string;
  spaceType: string;
  city: string;
  neighborhood: string;
  pricePerNight: number;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "SUSPENDED";
  rejectionReason?: string;
  coverImage: string;
  createdAt: string;
}

interface HostBooking {
  id: string;
  referenceCode: string;
  propertyId: string;
  propertyTitle: string;
  propertyCity: string;
  propertyNeighborhood: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  guestCount: number;
  startDate: string;
  endDate: string;
  totalNights: number;
  totalPrice: number;
  bookingStatus: string;
  paymentStatus: string;
  paymentReference?: string;
  createdAt: string;
}

export default function HostDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [properties, setProperties] = useState<HostProperty[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [activeTab, setActiveTab] = useState<"properties" | "bookings">("properties");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [stats, setStats] = useState<{
    totalProperties: number;
    published: number;
    pending: number;
    drafts: number;
    rejected: number;
    earnings: { totalGross: number; totalNet: number };
  } | null>(null);

  // Availability modal states
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<HostProperty | null>(null);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<any[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?next=/host/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New Property Form State
  const [title, setTitle] = useState("");
  const [propertyType, setPropertyType] = useState("Serviced Apartment");
  const [spaceType, setSpaceType] = useState("Entire place");
  const [city, setCity] = useState("Abuja");
  const [neighborhood, setNeighborhood] = useState("Maitama");
  const [state, setState] = useState("FCT");
  const [pricePerNight, setPricePerNight] = useState<number>(85000);
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [beds, setBeds] = useState(2);
  const [maxGuests, setMaxGuests] = useState(4);
  const [powerType, setPowerType] = useState("Solar + Inverter");
  const [coverImage, setCoverImage] = useState(
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80"
  );
  const [description, setDescription] = useState(
    "Spacious, serene retreat with 24/7 dedicated solar inverter power, uninterrupted high-speed Wi-Fi, and 24-hour estate gate security."
  );
  // Quarantined details
  const [exactAddress, setExactAddress] = useState("Plot 412, Aguiyi Ironsi Way, Maitama, Abuja");
  const [unitNumber, setUnitNumber] = useState("Suite 3B");
  const [contactName, setContactName] = useState("Emeka Okonkwo");
  const [contactPhone, setContactPhone] = useState("+2348031234567");
  const [contactEmail, setContactEmail] = useState("host@ile.ng");
  const [accessGateCode, setAccessGateCode] = useState("GATE-9912");

  const loadProperties = async () => {
    setLoading(true);
    try {
      const res = await api.getHostProperties();
      if (res && res.properties) {
        setProperties(res.properties);
      }
    } catch (err: any) {
      console.warn("Could not load host properties:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await api.getHostBookings();
      if (res && res.bookings) {
        setBookings(res.bookings);
      }
    } catch (err: any) {
      console.warn("Could not load host bookings:", err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.getHostDashboard();
      if (res) {
        setStats(res);
      }
    } catch (err: any) {
      console.warn("Could not load host dashboard stats:", err);
    }
  };

  const openAvailabilityModal = async (prop: HostProperty) => {
    setSelectedProperty(prop);
    setShowAvailabilityModal(true);
    setAvailabilityMessage(null);
    setLoadingAvailability(true);
    try {
      const res = await api.getHostPropertyAvailability(prop.id);
      if (res && res.blocks) {
        setAvailabilityBlocks(res.blocks);
      }
    } catch (err: any) {
      console.warn("Could not load availability:", err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleBlockDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty || !blockStart || !blockEnd) return;
    setIsBlocking(true);
    setAvailabilityMessage(null);
    try {
      await api.blockHostPropertyDates(selectedProperty.id, {
        startDate: blockStart,
        endDate: blockEnd,
      });
      setAvailabilityMessage("Dates successfully blocked from public search.");
      setBlockStart("");
      setBlockEnd("");
      const res = await api.getHostPropertyAvailability(selectedProperty.id);
      if (res && res.blocks) {
        setAvailabilityBlocks(res.blocks);
      }
    } catch (err: any) {
      alert(err.message || "Failed to block dates.");
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockDates = async (blockId: string) => {
    if (!selectedProperty) return;
    try {
      await api.unblockHostPropertyDates(selectedProperty.id, blockId);
      setAvailabilityMessage("Dates unblocked and returned to public inventory.");
      const res = await api.getHostPropertyAvailability(selectedProperty.id);
      if (res && res.blocks) {
        setAvailabilityBlocks(res.blocks);
      }
    } catch (err: any) {
      alert(err.message || "Failed to unblock dates.");
    }
  };

  const handleDeleteProperty = async (propId: string) => {
    if (!confirm("Are you sure you want to permanently delete this listing?")) return;
    try {
      await api.deleteHostProperty(propId);
      setActionMessage("Listing deleted successfully.");
      loadProperties();
      loadStats();
    } catch (err: any) {
      alert(err.message || "Failed to delete property.");
    }
  };

  useEffect(() => {
    loadProperties();
    loadBookings();
    loadStats();
  }, []);

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);

    try {
      await api.createHostProperty({
        title,
        propertyType,
        spaceType,
        city,
        neighborhood,
        state,
        pricePerNight: Number(pricePerNight),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        beds: Number(beds),
        maxGuests: Number(maxGuests),
        powerType,
        coverImage,
        description,
        exactAddress,
        unitNumber,
        contactName,
        contactPhone,
        contactEmail,
        accessGateCode,
      });

      setShowCreateModal(false);
      setActionMessage("Property listing created as DRAFT successfully!");
      loadProperties();
    } catch (err: any) {
      alert(err.message || "Failed to create property");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForReview = async (propId: string) => {
    try {
      await api.submitPropertyForReview(propId);
      setActionMessage("Property submitted for admin physical verification & review!");
      loadProperties();
    } catch (err: any) {
      alert(err.message || "Failed to submit property for review");
    }
  };

  const handleRelistProperty = async (propId: string) => {
    if (!confirm("Relist this property? It will return to PUBLISHED status and become bookable again.")) return;
    try {
      await api.relistHostProperty(propId);
      setActionMessage("Property relisted and is now live in search results!");
      loadProperties();
      loadStats();
    } catch (err: any) {
      alert(err.message || "Failed to relist property.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} />
            Published &amp; Live
          </span>
        );
      case "PENDING_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} />
            Pending Verification
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={13} />
            Action Required / Rejected
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <AlertTriangle size={13} />
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            Draft
          </span>
        );
    }
  };

  const getBookingStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} />
            Confirmed
          </span>
        );
      case "PAYMENT_PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            Payment Pending
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={12} />
            Cancelled
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 size={12} />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    if (status === "SUCCESS") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
        {status || "Pending"}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-12 px-6 sm:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E5E0] pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0B5D45]">
              <Home size={15} />
              <span>Host Management Portal</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-[#171717] font-normal mt-1">
              Your Properties &amp; Listings
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-[14px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
              >
                Go to Admin Portal →
              </Link>
            )}
            <Link
              href="/become-a-host"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B5D45] text-white text-[14px] font-medium hover:bg-[#084936] transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span>List New Property</span>
            </Link>
          </div>
        </div>

        {/* Operational Performance Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-[#E7E5E0] shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B67] flex items-center justify-between">
              <span>Published Listings</span>
              <Building size={16} className="text-[#0B5D45]" />
            </div>
            <div className="text-3xl font-display font-medium text-[#171717] mt-2">
              {stats?.published ?? properties.filter((p) => p.status === "PUBLISHED").length}
            </div>
            <div className="text-xs text-[#8B8B86] mt-1">
              Active in public search
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-[#E7E5E0] shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B67] flex items-center justify-between">
              <span>Under Review</span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <div className="text-3xl font-display font-medium text-[#171717] mt-2">
              {stats?.pending ?? properties.filter((p) => p.status === "PENDING_REVIEW").length}
            </div>
            <div className="text-xs text-amber-700 mt-1">
              Pending admin verification
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-[#E7E5E0] shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B67] flex items-center justify-between">
              <span>Total Reservations</span>
              <Calendar size={16} className="text-[#0B5D45]" />
            </div>
            <div className="text-3xl font-display font-medium text-[#171717] mt-2">
              {bookings.length}
            </div>
            <div className="text-xs text-[#8B8B86] mt-1">
              Confirmed &amp; pending stays
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-[#E7E5E0] shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B67] flex items-center justify-between">
              <span>Net Host Earnings</span>
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <div className="text-3xl font-display font-medium text-emerald-800 mt-2">
              {formatNaira(stats?.earnings?.totalNet || 0)}
            </div>
            <div className="text-xs text-[#8B8B86] mt-1">
              Gross: {formatNaira(stats?.earnings?.totalGross || 0)}
            </div>
          </div>
        </div>

        {/* Action alert message */}
        {actionMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
            <span>{actionMessage}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E7E5E0] gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("properties")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "properties"
                ? "border-[#0B5D45] text-[#0B5D45]"
                : "border-transparent text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            <Home size={16} />
            <span>My Listings ({properties.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "bookings"
                ? "border-[#0B5D45] text-[#0B5D45]"
                : "border-transparent text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            <Calendar size={16} />
            <span>Reservations &amp; Bookings ({bookings.length})</span>
          </button>
        </div>

        {/* Tab 1: Listings Overview */}
        {activeTab === "properties" && (
          <>
            {/* Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "ALL", label: "All Properties", count: properties.length },
                { id: "PUBLISHED", label: "Published & Live", count: properties.filter((p) => p.status === "PUBLISHED").length },
                { id: "PENDING_REVIEW", label: "Pending Review", count: properties.filter((p) => p.status === "PENDING_REVIEW").length },
                { id: "DRAFT", label: "Drafts", count: properties.filter((p) => p.status === "DRAFT").length },
                { id: "REJECTED", label: "Needs Attention", count: properties.filter((p) => p.status === "REJECTED").length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
                    statusFilter === tab.id
                      ? "bg-[#0B5D45] text-white shadow-sm"
                      : "bg-white border border-[#E7E5E0] text-[#6B6B67] hover:text-[#171717]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      statusFilter === tab.id ? "bg-white/20 text-white" : "bg-stone-100 text-[#6B6B67]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-[#6B6B67]">
                <Loader2 size={24} className="animate-spin mr-2 text-[#0B5D45]" />
                <span>Loading your listings...</span>
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-2xl border border-[#E7E5E0] space-y-4 max-w-lg mx-auto">
                <Building size={40} className="mx-auto text-[#0B5D45]" />
                <h3 className="font-display text-2xl text-[#171717]">No properties listed yet</h3>
                <p className="text-[15px] text-[#6B6B67]">
                  Start hosting on Ilé. Create a listing, specify your 24/7 power setup, and submit for verification.
                </p>
                <Link
                  href="/become-a-host"
                  className="inline-block px-6 py-3 bg-[#0B5D45] text-white text-sm font-medium rounded-xl hover:bg-[#084936] transition-colors"
                >
                  Create your first listing
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties
                  .filter((p) => (statusFilter === "ALL" ? true : p.status === statusFilter))
                  .map((prop) => (
                    <div
                      key={prop.id}
                      className="bg-white rounded-2xl border border-[#E7E5E0] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="relative aspect-[16/10] bg-[#E7E5E0]">
                        <Image
                          src={prop.coverImage || "/images/placeholder-property.jpg"}
                          alt={prop.title}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute top-3 left-3">{getStatusBadge(prop.status)}</div>
                      </div>

                      {/* Rejection Banner */}
                      {prop.status === "REJECTED" && (
                        <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                          <span className="font-bold">Moderator Notice: </span>
                          <span>{prop.rejectionReason || "Listing needs edits before publication."}</span>
                        </div>
                      )}

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <h3 className="font-medium text-[17px] text-[#171717]">{prop.title}</h3>
                          <p className="text-xs text-[#6B6B67] mt-0.5">
                            {prop.neighborhood}, {prop.city} · {prop.propertyType}
                          </p>
                          <div className="mt-3 font-semibold text-[15px] text-[#171717]">
                            {formatNaira(prop.pricePerNight)}{" "}
                            <span className="text-xs font-normal text-[#6B6B67]">/ night</span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#E7E5E0] flex flex-wrap items-center justify-between gap-2">
                          {/* Draft actions */}
                          {prop.status === "DRAFT" && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSubmitForReview(prop.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B5D45] text-white text-xs font-semibold hover:bg-[#084936]"
                              >
                                <Send size={12} />
                                <span>Submit for Review</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProperty(prop.id)}
                                title="Delete Draft"
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}

                          {/* Pending review info */}
                          {prop.status === "PENDING_REVIEW" && (
                            <span className="text-xs text-amber-700 italic flex items-center gap-1">
                              <Clock size={12} />
                              <span>Under admin inspection</span>
                            </span>
                          )}

                          {/* Published actions */}
                          {prop.status === "PUBLISHED" && (
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/stay/${prop.slug}`}
                                className="inline-flex items-center gap-1 text-xs text-[#0B5D45] font-semibold hover:underline"
                              >
                                <Eye size={13} />
                                <span>Live Stay</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => openAvailabilityModal(prop)}
                                className="inline-flex items-center gap-1 text-xs text-[#171717] font-semibold px-2.5 py-1 rounded-lg border border-[#E7E5E0] hover:bg-stone-50"
                              >
                                <CalendarCheck size={12} className="text-[#0B5D45]" />
                                <span>Availability</span>
                              </button>
                            </div>
                          )}

                          {/* Rejected actions */}
                          {prop.status === "REJECTED" && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSubmitForReview(prop.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
                              >
                                <Send size={12} />
                                <span>Resubmit for Review</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRelistProperty(prop.id)}
                                title="Relist Property"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EDF3F0] text-[#0B5D45] text-xs font-semibold hover:bg-[#D5EAE1] border border-[#0B5D45]/20"
                              >
                                <RotateCcw size={12} />
                                <span>Relist</span>
                              </button>
                            </div>
                          )}

                          {/* Suspended actions */}
                          {prop.status === "SUSPENDED" && (
                            <button
                              type="button"
                              onClick={() => handleRelistProperty(prop.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EDF3F0] text-[#0B5D45] text-xs font-semibold hover:bg-[#D5EAE1] border border-[#0B5D45]/20"
                            >
                              <RotateCcw size={12} />
                              <span>Relist Property</span>
                            </button>
                          )}

                          <span className="text-[11px] text-[#8B8B86]">
                            ID: {prop.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {/* Tab 2: Guest Reservations Overview */}
        {activeTab === "bookings" && (
          <>
            {loadingBookings ? (
              <div className="flex items-center justify-center py-20 text-[#6B6B67]">
                <Loader2 size={24} className="animate-spin mr-2 text-[#0B5D45]" />
                <span>Loading your guest reservations...</span>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-2xl border border-[#E7E5E0] space-y-4 max-w-lg mx-auto">
                <Calendar size={40} className="mx-auto text-[#0B5D45]" />
                <h3 className="font-display text-2xl text-[#171717]">No reservations yet</h3>
                <p className="text-[15px] text-[#6B6B67]">
                  When guests book your properties, their reservation details, dates, and payment status will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E7E5E0] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F8F7F4] border-b border-[#E7E5E0] text-xs uppercase tracking-wider text-[#6B6B67]">
                      <tr>
                        <th className="py-3.5 px-4 font-semibold">Ref / Property</th>
                        <th className="py-3.5 px-4 font-semibold">Guest</th>
                        <th className="py-3.5 px-4 font-semibold">Dates &amp; Stay</th>
                        <th className="py-3.5 px-4 font-semibold">Amount</th>
                        <th className="py-3.5 px-4 font-semibold">Booking Status</th>
                        <th className="py-3.5 px-4 font-semibold">Payment</th>
                        <th className="py-3.5 px-4 font-semibold">Booked On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E0]">
                      {bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-semibold text-[#171717]">{b.referenceCode}</div>
                            <div className="text-xs text-[#6B6B67] line-clamp-1">{b.propertyTitle}</div>
                            <div className="text-[11px] text-[#8B8B86]">{b.propertyNeighborhood}, {b.propertyCity}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-[#171717]">{b.guestFirstName} {b.guestLastName}</div>
                            <div className="text-xs text-[#6B6B67]">{b.guestEmail}</div>
                            <div className="text-[11px] text-[#8B8B86]">{b.guestPhone}</div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="text-xs font-medium text-[#171717]">
                              {b.startDate} → {b.endDate}
                            </div>
                            <div className="text-xs text-[#6B6B67]">
                              {b.totalNights} {b.totalNights === 1 ? "night" : "nights"} · {b.guestCount} {b.guestCount === 1 ? "guest" : "guests"}
                            </div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="font-semibold text-[#171717]">
                              {formatNaira(b.totalPrice)}
                            </div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {getBookingStatusBadge(b.bookingStatus)}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {getPaymentStatusBadge(b.paymentStatus)}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap text-xs text-[#6B6B67]">
                            {new Date(b.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal: Create Property Listing */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 overflow-y-auto max-h-[90vh] shadow-2xl border border-[#E7E5E0] space-y-6">
              <div className="flex items-center justify-between border-b border-[#E7E5E0] pb-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-[#0B5D45] font-semibold">
                    New Listing
                  </span>
                  <h3 className="font-display text-2xl text-[#171717]">Create Property Listing</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-700 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProperty} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] uppercase mb-1">
                    Property Title
                  </label>
                  <input
                    required
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. The Hibiscus Penthouse"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45]"
                  />
                </div>

                {/* Types */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] uppercase mb-1">
                      Property Type
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45] bg-white"
                    >
                      <option value="Serviced Apartment">Serviced Apartment</option>
                      <option value="Private Residence">Private Residence</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Garden Villa">Garden Villa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] uppercase mb-1">
                      Space Type
                    </label>
                    <select
                      value={spaceType}
                      onChange={(e) => setSpaceType(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45] bg-white"
                    >
                      <option value="Entire place">Entire place</option>
                      <option value="Private room">Private room</option>
                      <option value="Shared room">Shared room</option>
                    </select>
                  </div>
                </div>

                {/* Location */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] uppercase mb-1">
                      City
                    </label>
                    <select
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setState(e.target.value === "Abuja" ? "FCT" : "Lagos State");
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45] bg-white"
                    >
                      <option value="Abuja">Abuja</option>
                      <option value="Lagos">Lagos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] uppercase mb-1">
                      Neighborhood
                    </label>
                    <input
                      required
                      type="text"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="e.g. Maitama, Ikoyi, Wuse 2"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] uppercase mb-1">
                      Nightly Rate (NGN)
                    </label>
                    <input
                      required
                      type="number"
                      value={pricePerNight}
                      onChange={(e) => setPricePerNight(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45]"
                    />
                  </div>
                </div>

                {/* Capacity */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B6B67] uppercase mb-1">
                      Bedrooms
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={bedrooms}
                      onChange={(e) => setBedrooms(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B6B67] uppercase mb-1">
                      Bathrooms
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      value={bathrooms}
                      onChange={(e) => setBathrooms(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B6B67] uppercase mb-1">
                      Beds
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={beds}
                      onChange={(e) => setBeds(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B6B67] uppercase mb-1">
                      Max Guests
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={maxGuests}
                      onChange={(e) => setMaxGuests(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] text-sm"
                    />
                  </div>
                </div>

                {/* Power infrastructure */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] uppercase mb-1">
                    Continuous Power Setup
                  </label>
                  <select
                    value={powerType}
                    onChange={(e) => setPowerType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:border-[#0B5D45] bg-white"
                  >
                    <option value="Solar + Inverter">Solar + Inverter (Continuous)</option>
                    <option value="Dual Silent Generator">Dual Silent Generator (Redundant)</option>
                    <option value="24/7 Dedicated Grid + Inverter">24/7 Dedicated Grid + Inverter</option>
                  </select>
                </div>

                {/* Quarantined Private Details Section */}
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs uppercase tracking-wider">
                    <Lock size={14} />
                    <span>Quarantined Access Details (Guarded until Confirmed Payment)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                        Exact Street Address
                      </label>
                      <input
                        required
                        type="text"
                        value={exactAddress}
                        onChange={(e) => setExactAddress(e.target.value)}
                        placeholder="House number, Street name"
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                        Unit / Flat Number
                      </label>
                      <input
                        type="text"
                        value={unitNumber}
                        onChange={(e) => setUnitNumber(e.target.value)}
                        placeholder="e.g. Apt 4B"
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                        Gate Pass Code
                      </label>
                      <input
                        type="text"
                        value={accessGateCode}
                        onChange={(e) => setAccessGateCode(e.target.value)}
                        placeholder="e.g. GATE-771"
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                        Host Phone (WhatsApp)
                      </label>
                      <input
                        required
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                        Host Email
                      </label>
                      <input
                        required
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 border border-[#E7E5E0] rounded-xl text-sm font-medium hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-[#0B5D45] text-white rounded-xl text-sm font-medium hover:bg-[#084936] transition-colors flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save as Draft</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Availability Management Modal */}
        {showAvailabilityModal && selectedProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
              <div className="flex items-start justify-between border-b border-[#E7E5E0] pb-4">
                <div>
                  <div className="flex items-center gap-2 text-[#0B5D45] text-xs font-semibold uppercase tracking-wider mb-1">
                    <CalendarCheck size={14} />
                    <span>Listing Availability Manager</span>
                  </div>
                  <h2 className="font-display text-2xl text-[#171717]">{selectedProperty.title}</h2>
                  <p className="text-xs text-[#6B6B67] mt-0.5">
                    {selectedProperty.neighborhood}, {selectedProperty.city} · ID: {selectedProperty.id.slice(0, 8)}...
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAvailabilityModal(false)}
                  className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                >
                  <XCircle size={22} />
                </button>
              </div>

              {availabilityMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#0B5D45] flex-shrink-0" />
                  <span>{availabilityMessage}</span>
                </div>
              )}

              {/* Form to block new dates */}
              <div className="p-5 rounded-2xl bg-[#F8F7F4] border border-[#E7E5E0] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                    <CalendarX size={16} className="text-amber-700" />
                    <span>Block Dates from Public Booking</span>
                  </h3>
                  <span className="text-[11px] text-[#6B6B67]">Host-initiated block</span>
                </div>
                <p className="text-xs text-[#6B6B67]">
                  Prevent guests from reserving your listing during renovations, private owner use, or off-season maintenance.
                </p>

                <form onSubmit={handleBlockDates} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#171717] uppercase mb-1">
                        Start Date
                      </label>
                      <input
                        required
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={blockStart}
                        onChange={(e) => setBlockStart(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#E7E5E0] bg-white text-xs font-medium focus:outline-none focus:border-[#0B5D45]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#171717] uppercase mb-1">
                        End Date
                      </label>
                      <input
                        required
                        type="date"
                        min={blockStart || new Date().toISOString().split("T")[0]}
                        value={blockEnd}
                        onChange={(e) => setBlockEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#E7E5E0] bg-white text-xs font-medium focus:outline-none focus:border-[#0B5D45]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isBlocking || !blockStart || !blockEnd}
                      className="px-4 py-2 bg-[#0B5D45] text-white text-xs font-semibold rounded-xl hover:bg-[#084936] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {isBlocking ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Blocking...</span>
                        </>
                      ) : (
                        <>
                          <CalendarX size={13} />
                          <span>Block Selected Dates</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Blocks & Reservations */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#171717] uppercase tracking-wider">
                  Active Restrictions & Reservations ({availabilityBlocks.length})
                </h3>

                {loadingAvailability ? (
                  <div className="py-8 flex justify-center items-center text-xs text-[#6B6B67]">
                    <Loader2 size={16} className="animate-spin mr-2 text-[#0B5D45]" />
                    <span>Loading calendar status...</span>
                  </div>
                ) : availabilityBlocks.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-[#E7E5E0] bg-stone-50">
                    <CheckCircle2 size={24} className="mx-auto text-[#0B5D45] mb-2" />
                    <p className="text-xs font-semibold text-[#171717]">100% Calendar Open</p>
                    <p className="text-[11px] text-[#6B6B67] mt-0.5">
                      No dates are blocked or reserved. This stay is currently open for search and bookings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {availabilityBlocks.map((b) => {
                      const isBooking = b.type === "RESERVATION" || !!b.bookingId;
                      return (
                        <div
                          key={b.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                            isBooking
                              ? "bg-amber-50/60 border-amber-200 text-amber-900"
                              : "bg-white border-[#E7E5E0] text-[#171717]"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              {isBooking ? (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-800 text-[11px] px-2 py-0.5 rounded-md bg-amber-100">
                                  <Lock size={10} />
                                  <span>GUEST RESERVATION {b.bookingReference ? `(${b.bookingReference})` : ""}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-stone-700 text-[11px] px-2 py-0.5 rounded-md bg-stone-100">
                                  <CalendarX size={10} />
                                  <span>MANUAL BLOCK</span>
                                </span>
                              )}
                              <span className="font-semibold text-xs">
                                {b.startDate} → {b.endDate}
                              </span>
                            </div>
                            {isBooking ? (
                              <p className="text-[11px] text-amber-700">
                                Protected guest booking. Dates are locked against manual changes.
                              </p>
                            ) : (
                              <p className="text-[11px] text-[#6B6B67]">
                                Blocked by host. Dates are hidden from search.
                              </p>
                            )}
                          </div>

                          <div>
                            {!isBooking ? (
                              <button
                                type="button"
                                onClick={() => handleUnblockDates(b.id)}
                                className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition-colors"
                              >
                                Unblock
                              </button>
                            ) : (
                              <span className="text-[11px] text-amber-800/80 font-medium italic">
                                Authoritative
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAvailabilityModal(false)}
                  className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-[#171717] rounded-xl text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
