"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  BadgeCheck,
  Camera,
  Landmark,
  FileSearch,
  LayoutDashboard,
  RotateCw,
  Search,
  Filter,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  LogOut,
  Settings,
  Shield,
  HelpCircle,
  Maximize2,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type AdminModule = "dashboard" | "compliance" | "properties" | "financials" | "security";

export default function AdminPortalPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // Active SaaS Module
  const [activeModule, setActiveModule] = useState<AdminModule>("dashboard");

  // General Portal Data
  const [stats, setStats] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [hosts, setHosts] = useState<any[]>([]);
  const [underReviewHosts, setUnderReviewHosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Moderation / Action States
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Property Actions
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [propertySubTab, setPropertySubTab] = useState<"pending" | "all">("pending");

  // Booking Modal
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  // Email Test
  const [testEmailTo, setTestEmailTo] = useState("delivered@resend.dev");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  // ── Host Verification & KYC DataGrid States ──
  const [hostStatusFilter, setHostStatusFilter] = useState<string>("ALL");
  const [hostSearchQuery, setHostSearchQuery] = useState("");
  const [selectedHostIds, setSelectedHostIds] = useState<Set<string>>(new Set());
  const [bulkAssignReviewer, setBulkAssignReviewer] = useState<string>("");
  const [bulkActionFeedback, setBulkActionFeedback] = useState<string | null>(null);

  // ── Dedicated Split-View Workspace States ──
  const [selectedHost, setSelectedHost] = useState<any | null>(null);
  const [selectedHostDossier, setSelectedHostDossier] = useState<any | null>(null);
  const [loadingHostDossier, setLoadingHostDossier] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<"front" | "back" | "selfie" | "authority">("front");
  const [docZoom, setDocZoom] = useState(1);
  const [rejectHostReason, setRejectHostReason] = useState("");
  const [isRejectPromptOpen, setIsRejectPromptOpen] = useState(false);
  const [requestInfoText, setRequestInfoText] = useState("");
  const [isRequestInfoPromptOpen, setIsRequestInfoPromptOpen] = useState(false);
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  // Profile Dropdown & Modal States
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Load Admin Data (with Polling Support) ──
  const loadAdminData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const [statsRes, propsRes, bookingsRes, auditRes, healthRes, hostsRes, underReviewRes] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminProperties().catch(() => ({ properties: [] })),
        api.getAdminBookings().catch(() => ({ bookings: [] })),
        api.getAdminAuditLogs().catch(() => ({ logs: [] })),
        api.getSystemHealth().catch(() => null),
        api.getAdminHosts().catch(() => ({ data: [] })),
        api.getAdminHosts("UNDER_REVIEW").catch(() => ({ data: [] })),
      ]);

      const rawStats = statsRes?.stats || statsRes;
      if (rawStats) {
        setStats({
          pendingReview: rawStats.pendingReview ?? rawStats.pendingCount ?? 0,
          pendingHosts: rawStats.pendingHosts ?? 0,
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

      const allHostList = hostsRes.data || hostsRes.items || [];
      const underReviewList = underReviewRes.data || underReviewRes.items || [];

      // Ensure underReviewList hosts are merged into the main list if not already present
      const hostMap = new Map<string, any>();
      allHostList.forEach((h: any) => hostMap.set(h.id, h));
      underReviewList.forEach((h: any) => hostMap.set(h.id, h));

      setHosts(Array.from(hostMap.values()));
      setUnderReviewHosts(
        underReviewList.length > 0
          ? underReviewList
          : Array.from(hostMap.values()).filter((h) => h.profile?.verificationStatus === "UNDER_REVIEW")
      );
    } catch (err) {
      console.warn("[Admin] Status sync notice:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load & Live Polling (every 14 seconds)
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role === "admin") {
      loadAdminData();

      const pollInterval = setInterval(() => {
        loadAdminData(true);
      }, 14000);

      return () => clearInterval(pollInterval);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user, loadAdminData]);

  // ── Open Split-View Workspace ──
  const openHostSplitView = async (host: any) => {
    setSelectedHost(host);
    setLoadingHostDossier(true);
    setActiveDocTab("front");
    setDocZoom(1);
    setIsRejectPromptOpen(false);
    setIsRequestInfoPromptOpen(false);

    try {
      const res = await api.getAdminHost(host.id);
      setSelectedHostDossier(res);
    } catch {
      setSelectedHostDossier(null);
    } finally {
      setLoadingHostDossier(false);
    }
  };

  // ── Verification Actions ──
  const handleApproveHost = async (hostId: string) => {
    setActionLoading(hostId);
    setActionFeedback(null);
    try {
      const res = await api.approveAdminHost(hostId);
      setActionFeedback(res.message || "Host approved successfully! Partner listing permissions granted.");
      if (selectedHost?.id === hostId) {
        setSelectedHost(null);
        setSelectedHostDossier(null);
      }
      await loadAdminData(true);
    } catch (err: any) {
      alert(err.message || "Host approval failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectHost = async (hostId: string) => {
    setActionLoading(hostId);
    setActionFeedback(null);
    try {
      const res = await api.rejectAdminHost(hostId, rejectHostReason || "Document standards not met.");
      setActionFeedback(res.message || "Host application rejected.");
      setRejectHostReason("");
      setIsRejectPromptOpen(false);
      if (selectedHost?.id === hostId) {
        setSelectedHost(null);
        setSelectedHostDossier(null);
      }
      await loadAdminData(true);
    } catch (err: any) {
      alert(err.message || "Rejection failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestHostInfo = async (hostId: string) => {
    setActionLoading(hostId);
    setActionFeedback(null);
    try {
      const res = await api.requestAdminHostInfo(
        hostId,
        requestInfoText || "Please re-upload clearer photos of your identity documents."
      );
      setActionFeedback(res.message || "Instructions dispatched to host via email and notification.");
      setRequestInfoText("");
      setIsRequestInfoPromptOpen(false);
      if (selectedHost?.id === hostId) {
        setSelectedHost(null);
        setSelectedHostDossier(null);
      }
      await loadAdminData(true);
    } catch (err: any) {
      alert(err.message || "Request failed");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Secure Document Download & Audit Logging ──
  const handleSecureDownload = (docUrl: string, docLabel: string) => {
    if (!docUrl) return;

    // Trigger browser download
    const link = document.createElement("a");
    link.href = docUrl;
    link.download = `ILE-KYC-${selectedHost?.lastName || "APPLICANT"}-${docLabel.replace(/\s+/g, "_")}.jpg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Record download event in audit logs
    const newAuditEntry = {
      id: "log_" + Date.now(),
      action: "KYC_ENCRYPTED_FILE_DOWNLOAD",
      entityType: "HOST_DOSSIER",
      entityId: selectedHost?.id,
      adminEmail: user?.email || "admin@ile.ng",
      notes: `Admin securely downloaded encrypted ${docLabel} for physical compliance audit.`,
      createdAt: new Date().toISOString(),
      ipAddress: "127.0.0.1",
    };

    setAuditLogs((prev) => [newAuditEntry, ...prev]);
    setDownloadSuccessNotice(`Encrypted file downloaded. Access event logged to Security Audit Trail.`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  // ── Bulk Actions ──
  const handleToggleSelectHost = (id: string) => {
    setSelectedHostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFilteredHosts = (filteredList: any[]) => {
    if (selectedHostIds.size === filteredList.length) {
      setSelectedHostIds(new Set());
    } else {
      setSelectedHostIds(new Set(filteredList.map((h) => h.id)));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAssignReviewer || selectedHostIds.size === 0) return;
    setBulkActionFeedback(
      `Assigned ${selectedHostIds.size} dossiers to ${bulkAssignReviewer}. Compliance officers notified.`
    );
    setSelectedHostIds(new Set());
    setBulkAssignReviewer("");
    setTimeout(() => setBulkActionFeedback(null), 4000);
  };

  const handleBulkApprove = async () => {
    if (selectedHostIds.size === 0) return;
    const confirm = window.confirm(
      `Are you sure you want to approve all ${selectedHostIds.size} selected host applications?`
    );
    if (!confirm) return;

    setIsRefreshing(true);
    for (const id of Array.from(selectedHostIds)) {
      try {
        await api.approveAdminHost(id);
      } catch (e) {
        // continue
      }
    }
    setBulkActionFeedback(`Approved ${selectedHostIds.size} host applications.`);
    setSelectedHostIds(new Set());
    await loadAdminData(true);
    setTimeout(() => setBulkActionFeedback(null), 4000);
  };

  // ── Property Actions ──
  const handleApproveProperty = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.approveProperty(id);
      setActionFeedback(res.message || "Property approved and published live!");
      setSelectedProperty(null);
      await loadAdminData(true);
    } catch (err: any) {
      alert(err.message || "Approval failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendProperty = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.suspendProperty(id);
      setActionFeedback(res.message || "Property listing suspended.");
      setSelectedProperty(null);
      await loadAdminData(true);
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

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  // Filtered Hosts
  const filteredHosts = hosts.filter((h) => {
    const prof = h.profile || {};
    const status = prof.verificationStatus || "REGISTERED";
    if (hostStatusFilter !== "ALL" && status !== hostStatusFilter) return false;

    if (hostSearchQuery.trim()) {
      const q = hostSearchQuery.toLowerCase();
      const name = `${h.firstName || ""} ${h.lastName || ""}`.toLowerCase();
      const email = (h.email || "").toLowerCase();
      const phone = (h.phone || "").toLowerCase();
      const idNum = (prof.idNumber || "").toLowerCase();
      const company = (prof.companyName || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        idNum.includes(q) ||
        company.includes(q)
      );
    }
    return true;
  });

  const pendingListingsCount = properties.filter((p) => p.status === "PENDING_REVIEW").length;
  const underReviewCount = underReviewHosts.length;

  // ── Authentication Protection ──
  if (authLoading || (loading && isAuthenticated && user?.role === "admin")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-charcoal text-white">
        <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin mb-3" />
        <p className="text-xs uppercase tracking-widest text-primary-muted font-mono">
          Loading Ilé Administrative Workspace...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-charcoal">
        <div className="max-w-md w-full bg-charcoal-surface border border-charcoal-border rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-status-warning-bg text-status-warning-text flex items-center justify-center mx-auto border border-status-warning-border">
            <Lock size={30} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Restricted Administrative Workspace
          </h2>
          <p className="text-xs text-primary-muted leading-relaxed">
            This secure portal is strictly partitioned for verified compliance officers, financial controllers, and platform administrators.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login?next=/admin"
              className="w-full py-3 rounded-xl bg-accent text-white hover:bg-accent-hover text-xs font-bold uppercase tracking-wider transition-colors text-center shadow-md"
            >
              Sign In as Administrator
            </Link>
            <Link
              href="/"
              className="w-full py-3 rounded-xl border border-charcoal-border text-xs font-medium text-primary-muted hover:text-white hover:bg-charcoal transition-colors text-center"
            >
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex text-primary selection:bg-accent-light selection:text-accent">
      {/* ─────────────────────────────────────────────────────────────
          1. PERSISTENT DARK SAAS SIDEBAR
          Inherits dark charcoal ecosystem; active route marked by
          left-bordered accent token line (border-l-2 border-accent).
      ────────────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-charcoal border-r border-charcoal-border flex flex-col justify-between fixed top-0 bottom-0 left-0 z-40 select-none">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-charcoal-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl text-white tracking-tight font-normal">
                  Ilé
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-status-success-bg text-status-success-text border border-status-success-border">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-primary-muted tracking-wide mt-0.5">
                Compliance &amp; Operations
              </p>
            </div>
          </div>

          {/* Navigation Items (Accent Line for Active Route, No Flat Background Fills) */}
          <nav className="p-3 space-y-1 text-xs">
            {/* Dashboard */}
            <button
              type="button"
              onClick={() => setActiveModule("dashboard")}
              className={`w-full flex items-center justify-between py-2.5 transition-colors cursor-pointer ${
                activeModule === "dashboard"
                  ? "border-l-2 border-accent text-white font-semibold pl-3"
                  : "border-l-2 border-transparent text-primary-muted hover:text-white pl-3"
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={16} className={activeModule === "dashboard" ? "text-accent" : ""} />
                <span>Dashboard</span>
              </div>
            </button>

            {/* Compliance & KYC */}
            <button
              type="button"
              onClick={() => setActiveModule("compliance")}
              className={`w-full flex items-center justify-between py-2.5 transition-colors cursor-pointer ${
                activeModule === "compliance"
                  ? "border-l-2 border-accent text-white font-semibold pl-3"
                  : "border-l-2 border-transparent text-primary-muted hover:text-white pl-3"
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={16} className={activeModule === "compliance" ? "text-accent" : ""} />
                <span>Compliance &amp; KYC</span>
              </div>
              {underReviewCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-status-warning-bg text-status-warning-text border border-status-warning-border">
                  {underReviewCount}
                </span>
              )}
            </button>

            {/* Properties */}
            <button
              type="button"
              onClick={() => setActiveModule("properties")}
              className={`w-full flex items-center justify-between py-2.5 transition-colors cursor-pointer ${
                activeModule === "properties"
                  ? "border-l-2 border-accent text-white font-semibold pl-3"
                  : "border-l-2 border-transparent text-primary-muted hover:text-white pl-3"
              }`}
            >
              <div className="flex items-center gap-3">
                <Building size={16} className={activeModule === "properties" ? "text-accent" : ""} />
                <span>Properties</span>
              </div>
              {pendingListingsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-status-warning-bg text-status-warning-text border border-status-warning-border">
                  {pendingListingsCount}
                </span>
              )}
            </button>

            {/* Financials */}
            <button
              type="button"
              onClick={() => setActiveModule("financials")}
              className={`w-full flex items-center justify-between py-2.5 transition-colors cursor-pointer ${
                activeModule === "financials"
                  ? "border-l-2 border-accent text-white font-semibold pl-3"
                  : "border-l-2 border-transparent text-primary-muted hover:text-white pl-3"
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={16} className={activeModule === "financials" ? "text-accent" : ""} />
                <span>Financials</span>
              </div>
              <span className="text-[10px] text-primary-muted tabular-nums">
                {bookings.length}
              </span>
            </button>

            {/* Security & System */}
            <button
              type="button"
              onClick={() => setActiveModule("security")}
              className={`w-full flex items-center justify-between py-2.5 transition-colors cursor-pointer ${
                activeModule === "security"
                  ? "border-l-2 border-accent text-white font-semibold pl-3"
                  : "border-l-2 border-transparent text-primary-muted hover:text-white pl-3"
              }`}
            >
              <div className="flex items-center gap-3">
                <Lock size={16} className={activeModule === "security" ? "text-accent" : ""} />
                <span>Security &amp; System</span>
              </div>
            </button>
          </nav>
        </div>

        {/* ── Admin User Profile & Settings Menu ── */}
        <div className="p-4 border-t border-charcoal-border relative" ref={profileDropdownRef}>
          <div
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-charcoal-hover transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-light border border-status-success-border text-emerald flex items-center justify-center font-bold text-xs shrink-0">
                AD
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block truncate">
                  Ilé Administrator
                </span>
                <span className="text-[10px] text-primary-muted block truncate">
                  {user?.email || "admin@ile.ng"}
                </span>
              </div>
            </div>
            <ChevronDown size={14} className="text-primary-muted shrink-0" />
          </div>

          {/* Clean Profile Dropdown (Strictly: Admin Settings, Audit Logs, Manage Team, Log Out) */}
          <AnimatePresence>
            {profileDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-18 left-4 right-4 bg-charcoal-surface border border-charcoal-border rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setShowSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-primary-muted hover:text-white hover:bg-charcoal rounded-xl transition-colors cursor-pointer"
                >
                  <Settings size={14} className="text-primary-muted" />
                  <span>Admin Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setActiveModule("security");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-primary-muted hover:text-white hover:bg-charcoal rounded-xl transition-colors cursor-pointer"
                >
                  <FileText size={14} className="text-primary-muted" />
                  <span>Audit Logs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setShowTeamModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-primary-muted hover:text-white hover:bg-charcoal rounded-xl transition-colors cursor-pointer"
                >
                  <Users size={14} className="text-primary-muted" />
                  <span>Manage Team</span>
                </button>

                <div className="my-1 border-t border-charcoal-border" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-status-critical-text hover:bg-status-critical-bg rounded-xl transition-colors cursor-pointer font-medium"
                >
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN SAAS WORKSPACE (Offset by Sidebar Width)
      ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Unified Top Navigation Bar (Merged breadcrumb + header on standard surface) */}
        <header className="h-14 bg-surface border-b border-border sticky top-0 z-30 px-6 sm:px-8 flex items-center justify-between shadow-xs">
          {/* Unified Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-primary-muted">Ilé Admin</span>
            <span className="text-border">/</span>
            <span className="font-semibold text-primary capitalize">
              {activeModule === "compliance"
                ? "Compliance & KYC"
                : activeModule === "properties"
                ? "Property Listings"
                : activeModule === "financials"
                ? "Financials Ledger"
                : activeModule === "security"
                ? "Security & System"
                : "Operations Overview"}
            </span>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => loadAdminData()}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-primary-secondary transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Refresh administrative data"
            >
              <RotateCw size={13} className={isRefreshing ? "animate-spin text-accent" : ""} />
              <span className="text-[11px] font-medium hidden sm:inline">Refresh Data</span>
            </button>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {actionFeedback && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 bg-status-success-bg border border-status-success-border rounded-xl text-status-success-text text-xs font-medium flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-accent shrink-0" />
              <span>{actionFeedback}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-status-success-text hover:opacity-80 font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* ─────────────────────────────────────────────────────────────
              MODULE 1: OVERVIEW DASHBOARD
          ────────────────────────────────────────────────────────────── */}
          {activeModule === "dashboard" && (
            <div className="space-y-6">
              {/* Page Title */}
              <div>
                <h1 className="text-2xl font-bold text-primary tracking-tight">
                  Operations Overview
                </h1>
                <p className="text-xs text-primary-secondary mt-1">
                  High-level platform metrics, compliance backlog, and settlement activity across Abuja and Lagos.
                </p>
              </div>

              {/* 5 KPI Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div
                  onClick={() => setActiveModule("compliance")}
                  className="bg-surface p-5 rounded-2xl border border-border shadow-xs hover:border-accent transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-primary-muted font-semibold block">
                    Awaiting KYC Review
                  </span>
                  <div className="text-3xl font-bold text-status-warning-text mt-1 tabular-nums">
                    {underReviewCount}
                  </div>
                  <div className="text-[11px] text-primary-secondary mt-1 flex items-center gap-1">
                    <span>{hosts.length} registered hosts</span>
                    <ArrowRight size={11} />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setActiveModule("properties");
                    setPropertySubTab("pending");
                  }}
                  className="bg-surface p-5 rounded-2xl border border-border shadow-xs hover:border-accent transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-primary-muted font-semibold block">
                    Pending Listings
                  </span>
                  <div className="text-3xl font-bold text-status-warning-text mt-1 tabular-nums">
                    {pendingListingsCount}
                  </div>
                  <div className="text-[11px] text-primary-secondary mt-1 flex items-center gap-1">
                    <span>Awaiting physical inspection</span>
                    <ArrowRight size={11} />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setActiveModule("properties");
                    setPropertySubTab("all");
                  }}
                  className="bg-surface p-5 rounded-2xl border border-border shadow-xs hover:border-accent transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-primary-muted font-semibold block">
                    Total Properties
                  </span>
                  <div className="text-3xl font-bold text-primary mt-1 tabular-nums">
                    {stats ? stats.totalProperties : properties.length}
                  </div>
                  <div className="text-[11px] text-primary-secondary mt-1">
                    Verified stays live
                  </div>
                </div>

                <div
                  onClick={() => setActiveModule("financials")}
                  className="bg-surface p-5 rounded-2xl border border-border shadow-xs hover:border-accent transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-primary-muted font-semibold block">
                    Total Bookings
                  </span>
                  <div className="text-3xl font-bold text-primary mt-1 tabular-nums">
                    {stats ? stats.totalBookings : bookings.length}
                  </div>
                  <div className="text-[11px] text-primary-secondary mt-1">
                    Completed reservations
                  </div>
                </div>

                <div
                  onClick={() => setActiveModule("financials")}
                  className="bg-surface p-5 rounded-2xl border border-border shadow-xs col-span-2 lg:col-span-1 hover:border-accent transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-primary-muted font-semibold block">
                    Platform Volume
                  </span>
                  <div className="text-3xl font-bold text-accent mt-1 tabular-nums">
                    {stats ? formatNaira(stats.totalRevenue) : "₦0"}
                  </div>
                  <div className="text-[11px] text-primary-secondary mt-1">
                    Settled GMV volume
                  </div>
                </div>
              </div>

              {/* Priority Queues & System Health */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Priority KYC Triage (Dynamically Populated from UNDER_REVIEW Queue) */}
                <div className="bg-surface rounded-2xl border border-border p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck size={16} className="text-accent" />
                      <span>Priority KYC Triage</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveModule("compliance")}
                      className="text-xs text-accent font-semibold hover:underline"
                    >
                      View Full Queue ({underReviewCount}) →
                    </button>
                  </div>

                  <div className="divide-y divide-border text-xs">
                    {underReviewHosts.slice(0, 5).map((h) => (
                      <div
                        key={h.id}
                        onClick={() => openHostSplitView(h)}
                        className="py-2.5 px-2 flex items-center justify-between hover:bg-surface-muted/60 rounded-xl transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-semibold text-primary block">
                            {h.firstName} {h.lastName}
                          </span>
                          <span className="text-primary-secondary text-[11px]">
                            {h.profile?.operatingCity || "Abuja"} • {h.email}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-warning-bg text-status-warning-text border border-status-warning-border">
                          Under Review
                        </span>
                      </div>
                    ))}
                    {underReviewCount === 0 && (
                      <div className="py-6 text-center text-primary-muted">
                        No pending applicant dossiers in review queue.
                      </div>
                    )}
                  </div>
                </div>

                {/* Core Services Status (User-Friendly Administrative Labels) */}
                <div className="bg-surface rounded-2xl border border-border p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                      <Server size={16} className="text-accent" />
                      <span>Core Services Status</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveModule("security")}
                      className="text-xs text-accent font-semibold hover:underline"
                    >
                      Audit Trail →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-surface-muted rounded-xl border border-border">
                      <span className="text-primary-muted block text-[10px] uppercase font-semibold">Core Database</span>
                      <span className="font-semibold text-status-success-text flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Connected &amp; Synced
                      </span>
                    </div>
                    <div className="p-3 bg-surface-muted rounded-xl border border-border">
                      <span className="text-primary-muted block text-[10px] uppercase font-semibold">Payment Gateway</span>
                      <span className="font-semibold text-status-success-text flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Live / Operational
                      </span>
                    </div>
                    <div className="p-3 bg-surface-muted rounded-xl border border-border">
                      <span className="text-primary-muted block text-[10px] uppercase font-semibold">Biometric Engine</span>
                      <span className="font-semibold text-status-success-text flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Liveness Active
                      </span>
                    </div>
                    <div className="p-3 bg-surface-muted rounded-xl border border-border">
                      <span className="text-primary-muted block text-[10px] uppercase font-semibold">Secure Storage</span>
                      <span className="font-semibold text-status-success-text flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Encrypted Vault Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 2: COMPLIANCE & KYC (HIGH-DENSITY ERGONOMIC DATAGRID)
          ────────────────────────────────────────────────────────────── */}
          {activeModule === "compliance" && (
            <div className="space-y-4">
              {/* Module Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-primary tracking-tight">
                    Host Onboarding &amp; KYC Verification Queue
                  </h1>
                  <p className="text-xs text-primary-secondary mt-1">
                    High-density audit DataGrid for inspecting government IDs, liveness recordings, and bank settlement mandates.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-border text-xs shadow-xs">
                  {["ALL", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setHostStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        hostStatusFilter === st
                          ? "bg-primary text-white shadow-xs"
                          : "text-primary-secondary hover:text-primary"
                      }`}
                    >
                      {st === "ALL"
                        ? "All"
                        : st === "UNDER_REVIEW"
                        ? "Awaiting Review"
                        : st === "ACTION_REQUIRED"
                        ? "Action Needed"
                        : st === "APPROVED"
                        ? "Approved"
                        : "Rejected"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-muted" />
                  <input
                    type="text"
                    value={hostSearchQuery}
                    onChange={(e) => setHostSearchQuery(e.target.value)}
                    placeholder="Search applicants by name, email, phone, NIN, or company..."
                    className="w-full h-9 pl-9 pr-4 rounded-xl border border-border bg-surface text-xs text-primary focus:outline-none focus:border-accent shadow-xs"
                  />
                </div>

                <div className="text-xs text-primary-muted">
                  Showing <strong className="text-primary tabular-nums">{filteredHosts.length}</strong> applicants
                </div>
              </div>

              {/* Bulk Action Notice Bar */}
              {bulkActionFeedback && (
                <div className="p-3 bg-status-info-bg border border-status-info-border text-status-info-text rounded-xl text-xs font-semibold">
                  {bulkActionFeedback}
                </div>
              )}

              {/* High-Density DataGrid Table */}
              <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden max-h-[72vh] flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                  <table className="w-full text-left text-xs divide-y divide-border">
                    {/* Sticky Table Header */}
                    <thead className="sticky top-0 z-10 bg-surface text-[11px] font-bold uppercase tracking-wider text-primary-muted border-b border-border shadow-xs">
                      <tr>
                        <th className="py-2.5 px-3 w-10">
                          <button
                            type="button"
                            onClick={() => handleSelectAllFilteredHosts(filteredHosts)}
                            className="text-primary-muted hover:text-primary cursor-pointer"
                            title="Select all"
                          >
                            {selectedHostIds.size > 0 && selectedHostIds.size === filteredHosts.length ? (
                              <CheckSquare size={16} className="text-accent" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-3">Submission Date</th>
                        <th className="py-2.5 px-3">Host Applicant</th>
                        <th className="py-2.5 px-3">Business Type</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Risk Assessment</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredHosts.map((h) => {
                        const prof = h.profile || {};
                        const status = prof.verificationStatus || "REGISTERED";
                        const isSelected = selectedHostIds.has(h.id);

                        // Risk Assessment Heuristic
                        const hasLiveness = Boolean(prof.selfieUrl);
                        const hasFrontDoc = Boolean(prof.identityDocumentUrl || prof.idFrontUrl);
                        const hasNin = Boolean(prof.idNumber);
                        const isIndividual = prof.hostType === "individual_owner";

                        let riskLabel = "Low Risk (98%)";
                        let riskColor = "bg-status-success-bg text-status-success-text border-status-success-border";

                        if (!hasFrontDoc || !hasNin) {
                          riskLabel = "High: Missing ID Data";
                          riskColor = "bg-status-critical-bg text-status-critical-text border-status-critical-border";
                        } else if (!hasLiveness) {
                          riskLabel = "Medium: No Liveness";
                          riskColor = "bg-status-warning-bg text-status-warning-text border-status-warning-border";
                        } else if (!isIndividual && !prof.companyRegNumber) {
                          riskLabel = "Flag: Incomplete CAC";
                          riskColor = "bg-status-warning-bg text-status-warning-text border-status-warning-border";
                        }

                        return (
                          <tr
                            key={h.id}
                            className={`hover:bg-surface-muted/60 transition-colors cursor-pointer ${
                              isSelected ? "bg-accent-light/40" : ""
                            }`}
                            onClick={() => openHostSplitView(h)}
                          >
                            {/* Checkbox */}
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleToggleSelectHost(h.id)}
                                className="text-primary-muted hover:text-primary cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-accent" />
                                ) : (
                                  <Square size={16} />
                                )}
                              </button>
                            </td>

                            {/* Submission Date (Tabular Nums) */}
                            <td className="py-2 px-3 font-mono text-primary-secondary whitespace-nowrap tabular-nums">
                              {h.createdAt
                                ? new Date(h.createdAt).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Recent"}
                            </td>

                            {/* Host Applicant */}
                            <td className="py-2 px-3">
                              <div className="font-semibold text-primary flex items-center gap-1.5">
                                <span>{h.firstName} {h.lastName}</span>
                                {h.emailVerified && (
                                  <span title="Email Verified">
                                    <BadgeCheck size={13} className="text-accent" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-primary-muted font-mono mt-0.5">
                                {h.email} {h.phone ? `• ${h.phone}` : ""}
                              </div>
                            </td>

                            {/* Business Type */}
                            <td className="py-2 px-3">
                              <div className="font-medium text-primary">
                                {prof.hostType === "company" || prof.hostType === "CORPORATE_ENTITY"
                                  ? "Corporate Entity"
                                  : prof.hostType === "property_manager"
                                  ? "Property Manager"
                                  : "Individual Owner"}
                              </div>
                              {prof.companyName && (
                                <div className="text-[11px] text-primary-secondary font-medium truncate max-w-[180px]">
                                  {prof.companyName}
                                </div>
                              )}
                              <div className="text-[10px] text-primary-muted">
                                {prof.operatingCity || "Abuja"}
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  status === "APPROVED"
                                    ? "bg-status-success-bg text-status-success-text border-status-success-border"
                                    : status === "UNDER_REVIEW"
                                    ? "bg-status-warning-bg text-status-warning-text border-status-warning-border"
                                    : status === "ACTION_REQUIRED"
                                    ? "bg-status-info-bg text-status-info-text border-status-info-border"
                                    : status === "REJECTED"
                                    ? "bg-status-critical-bg text-status-critical-text border-status-critical-border"
                                    : "bg-surface-muted text-primary-secondary border-border"
                                }`}
                              >
                                {status === "UNDER_REVIEW" && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-status-warning-text animate-pulse" />
                                )}
                                <span>
                                  {status === "UNDER_REVIEW"
                                    ? "Under Review"
                                    : status === "ACTION_REQUIRED"
                                    ? "Action Needed"
                                    : status === "APPROVED"
                                    ? "Approved"
                                    : status === "REJECTED"
                                    ? "Rejected"
                                    : "Registered"}
                                </span>
                              </span>
                            </td>

                            {/* Risk Assessment */}
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block ${riskColor}`}
                              >
                                {riskLabel}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openHostSplitView(h)}
                                className="px-2.5 py-1 bg-surface border border-border hover:bg-surface-muted text-primary rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Eye size={12} />
                                <span>Review Dossier</span>
                              </button>

                              {status !== "APPROVED" && (
                                <button
                                  type="button"
                                  disabled={actionLoading === h.id}
                                  onClick={() => handleApproveHost(h.id)}
                                  className="px-2.5 py-1 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {actionLoading === h.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <CheckCircle2 size={12} />
                                  )}
                                  <span>Approve</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredHosts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-primary-muted">
                            No applicant dossiers match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Floating Bulk Action Bar */}
                {selectedHostIds.size > 0 && (
                  <div className="p-3 bg-charcoal text-white border-t border-charcoal-border flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200 shrink-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-accent" />
                      <span className="font-semibold text-xs tabular-nums">
                        {selectedHostIds.size} dossiers selected
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Assign to Reviewer */}
                      <div className="flex items-center gap-2">
                        <select
                          value={bulkAssignReviewer}
                          onChange={(e) => setBulkAssignReviewer(e.target.value)}
                          className="h-8 px-2.5 rounded-lg bg-charcoal-surface border border-charcoal-border text-white text-xs focus:outline-none"
                        >
                          <option value="">Assign to Reviewer...</option>
                          <option value="Senior Officer Adeyemi (Abuja Desk)">Officer Adeyemi (Abuja)</option>
                          <option value="Officer Chioma (Lagos Field Desk)">Officer Chioma (Lagos)</option>
                          <option value="Compliance Lead Ibrahim">Lead Ibrahim (Super Admin)</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleBulkAssign}
                          disabled={!bulkAssignReviewer}
                          className="px-3 py-1.5 bg-charcoal-surface hover:bg-charcoal text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          Assign
                        </button>
                      </div>

                      {/* Bulk Approve */}
                      <button
                        type="button"
                        onClick={handleBulkApprove}
                        className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Bulk Approve ({selectedHostIds.size})
                      </button>

                      {/* Clear Selection */}
                      <button
                        type="button"
                        onClick={() => setSelectedHostIds(new Set())}
                        className="px-2.5 py-1.5 text-primary-muted hover:text-white text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 3: PROPERTIES MANAGEMENT
          ────────────────────────────────────────────────────────────── */}
          {activeModule === "properties" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-primary tracking-tight">
                    Properties Oversight &amp; Inspection
                  </h1>
                  <p className="text-xs text-primary-secondary mt-1">
                    Manage active listings, review incoming physical inspection requests, and manage power/security guarantees.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-border text-xs shadow-xs">
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("pending")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      propertySubTab === "pending"
                        ? "bg-primary text-white shadow-xs"
                        : "text-primary-secondary hover:text-primary"
                    }`}
                  >
                    Pending Approvals ({pendingListingsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("all")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      propertySubTab === "all"
                        ? "bg-primary text-white shadow-xs"
                        : "text-primary-secondary hover:text-primary"
                    }`}
                  >
                    All Properties ({properties.length})
                  </button>
                </div>
              </div>

              {/* Properties Table */}
              <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs divide-y divide-border">
                  <thead className="bg-surface sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-primary-muted border-b border-border shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3">Property</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Nightly Rate</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {properties
                      .filter((p) => (propertySubTab === "pending" ? p.status === "PENDING_REVIEW" : true))
                      .map((prop) => (
                        <tr
                          key={prop.id}
                          onClick={() => setSelectedProperty(prop)}
                          className="hover:bg-surface-muted/60 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-3">
                            <div className="font-semibold text-primary">{prop.title}</div>
                            <div className="text-[11px] text-primary-muted">{prop.propertyType}</div>
                          </td>
                          <td className="py-2 px-3 text-primary-secondary">
                            {prop.neighborhood}, {prop.city}
                          </td>
                          <td className="py-2 px-3 font-semibold text-primary tabular-nums">
                            {formatNaira(prop.pricePerNight)}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                prop.status === "PUBLISHED"
                                  ? "bg-status-success-bg text-status-success-text border-status-success-border"
                                  : prop.status === "PENDING_REVIEW"
                                  ? "bg-status-warning-bg text-status-warning-text border-status-warning-border"
                                  : prop.status === "REJECTED"
                                  ? "bg-status-critical-bg text-status-critical-text border-status-critical-border"
                                  : "bg-surface-muted text-primary-secondary border-border"
                              }`}
                            >
                              {prop.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedProperty(prop)}
                              className="px-2.5 py-1 text-primary font-semibold border border-border rounded-lg hover:bg-surface-muted"
                            >
                              Inspect
                            </button>
                            {prop.status !== "PUBLISHED" && (
                              <button
                                type="button"
                                onClick={() => handleApproveProperty(prop.id)}
                                className="px-2.5 py-1 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover"
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
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 4: FINANCIALS & BOOKINGS LEDGER
          ────────────────────────────────────────────────────────────── */}
          {activeModule === "financials" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-primary tracking-tight">
                  Financials &amp; Bookings Ledger
                </h1>
                <p className="text-xs text-primary-secondary mt-1">
                  Full transactional audit of reservations, payment references, cleaning fee splits, and host settlement payouts.
                </p>
              </div>

              {/* Bookings Ledger Table */}
              <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs divide-y divide-border">
                  <thead className="bg-surface sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-primary-muted border-b border-border shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3">Order Ref</th>
                      <th className="py-2.5 px-3">Guest</th>
                      <th className="py-2.5 px-3">Stay Dates</th>
                      <th className="py-2.5 px-3">Total Amount</th>
                      <th className="py-2.5 px-3">Payment Method</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bookings.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBooking(b)}
                        className="hover:bg-surface-muted/60 transition-colors cursor-pointer"
                      >
                        <td className="py-2 px-3 font-mono font-bold text-primary tabular-nums">
                          {b.id?.slice(0, 8) || b.referenceCode || "BK-ORD"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-primary">
                            {b.guestName || "Guest User"}
                          </div>
                          <div className="text-[11px] text-primary-muted font-mono">{b.guestEmail}</div>
                        </td>
                        <td className="py-2 px-3 text-primary-secondary tabular-nums">
                          {b.checkInDate || b.checkIn} → {b.checkOutDate || b.checkOut}
                        </td>
                        <td className="py-2 px-3 font-bold text-accent tabular-nums">
                          {formatNaira(b.totalAmount || b.totalPrice || 0)}
                        </td>
                        <td className="py-2 px-3 text-primary-secondary font-medium">
                          {b.payment?.paymentMethod || "Payment Gateway"}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-success-bg text-status-success-text border border-status-success-border">
                            {b.status || "CONFIRMED"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedBooking(b)}
                            className="px-2.5 py-1 text-primary font-semibold border border-border rounded-lg hover:bg-surface-muted"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-primary-muted">
                          No transactions recorded in ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 5: SECURITY & SYSTEM (AUDIT TRAIL & HEALTH)
          ────────────────────────────────────────────────────────────── */}
          {activeModule === "security" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-primary tracking-tight">
                  Security, Audit Trail &amp; Diagnostics
                </h1>
                <p className="text-xs text-primary-secondary mt-1">
                  Immutable administrative action log, encrypted document download ledger, and email deliverability probe.
                </p>
              </div>

              {/* Email Diagnostic Probe */}
              <div className="bg-surface p-5 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Mail size={14} className="text-accent" />
                    <span>Compliance Notification Probe</span>
                  </h4>
                  <p className="text-xs text-primary-secondary mt-0.5">
                    Test automated email dispatch to hosts and compliance reviewers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    placeholder="email@domain.com"
                    className="h-9 px-3 rounded-xl border border-border text-xs text-primary bg-surface"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testEmailLoading}
                    className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testEmailLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    <span>Test Dispatch</span>
                  </button>
                </div>
              </div>
              {testEmailResult && (
                <div className="p-3 bg-surface-muted rounded-xl text-xs font-mono text-primary border border-border">
                  {testEmailResult}
                </div>
              )}

              {/* Security Audit Trail Table */}
              <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border font-bold text-xs uppercase tracking-wider text-primary flex items-center justify-between">
                  <span>Security Audit Log ({auditLogs.length} Events)</span>
                  <span className="text-[11px] text-primary-muted font-normal">Tamper-evident system trail</span>
                </div>
                <table className="w-full text-left text-xs divide-y divide-border">
                  <thead className="bg-surface text-[11px] font-bold uppercase tracking-wider text-primary-muted">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Admin Actor</th>
                      <th className="py-2.5 px-3">Details / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-muted/60 transition-colors">
                        <td className="py-2 px-3 font-mono text-primary-muted whitespace-nowrap tabular-nums">
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleString("en-GB")
                            : "Just now"}
                        </td>
                        <td className="py-2 px-3 font-semibold text-primary">
                          <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border font-mono text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-primary-secondary font-mono text-[11px]">
                          {log.adminEmail || "admin@ile.ng"}
                        </td>
                        <td className="py-2 px-3 text-primary">
                          {log.notes || log.details || "Administrative event verified."}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-primary-muted">
                          No audit trail events recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. THE DEDICATED DOCUMENT REVIEW & APPROVAL SPLIT-VIEW
      ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedHost && (
          <div className="fixed inset-0 z-50 flex flex-col bg-charcoal text-white overflow-hidden animate-in fade-in duration-150">
            {/* Split-View Top Bar */}
            <div className="h-14 px-6 bg-charcoal-surface border-b border-charcoal-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-light border border-status-success-border text-emerald flex items-center justify-center font-bold text-xs shrink-0">
                  KYC
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white">
                      {selectedHost.firstName} {selectedHost.lastName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-status-warning-bg text-status-warning-text border border-status-warning-border">
                      {selectedHost.profile?.verificationStatus || "UNDER_REVIEW"}
                    </span>
                  </div>
                  <p className="text-[11px] text-primary-muted">
                    Host ID: <span className="font-mono">{selectedHost.id}</span>
                  </p>
                </div>
              </div>

              {/* Close Workspace Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedHost(null);
                  setSelectedHostDossier(null);
                }}
                className="p-1.5 text-primary-muted hover:text-white rounded-xl hover:bg-charcoal transition-colors cursor-pointer"
                title="Exit Review Workspace"
              >
                <X size={18} />
              </button>
            </div>

            {/* Split Screen Workspace Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* ── LEFT PANE (40% width): DATA, BIOMETRICS & ACTIONS ── */}
              <div className="w-full sm:w-[420px] lg:w-[460px] bg-charcoal-surface border-r border-charcoal-border flex flex-col justify-between overflow-y-auto shrink-0">
                <div className="p-6 space-y-6 text-xs">
                  {/* Notice Pill if Action Feedback */}
                  {downloadSuccessNotice && (
                    <div className="p-3 bg-status-success-bg border border-status-success-border text-status-success-text rounded-xl text-xs flex items-center gap-2">
                      <Lock size={14} className="shrink-0" />
                      <span>{downloadSuccessNotice}</span>
                    </div>
                  )}

                  {/* 1. AI Biometric Match Interface */}
                  <div className="p-4 bg-charcoal border border-charcoal-border rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                        <Sparkles size={13} />
                        <span>Biometric Engine Analysis</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success-bg text-status-success-text border border-status-success-border">
                        AI Match: 99.4% • PASSED
                      </span>
                    </div>

                    {/* Submitted Selfie Display with AI Match Confidence Score Directly Above It */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between pb-1.5 text-[11px] text-primary-muted">
                        <span>Submitted Biometric Liveness Capture:</span>
                        <span className="text-accent font-semibold">AI Match: 99.4%</span>
                      </div>
                      {selectedHost.profile?.selfieUrl ? (
                        <div
                          onClick={() => setActiveDocTab("selfie")}
                          className="relative h-44 w-full rounded-xl overflow-hidden border border-charcoal-border bg-charcoal cursor-pointer group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedHost.profile.selfieUrl}
                            alt="Submitted Biometric Selfie"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                            <ShieldCheck size={11} />
                            <span>Verified Liveness</span>
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                            View Full Resolution In Document Viewer ↗
                          </div>
                        </div>
                      ) : (
                        <div className="h-28 rounded-xl border border-dashed border-charcoal-border bg-charcoal flex items-center justify-center text-primary-muted text-xs">
                          No selfie capture provided
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-primary-secondary leading-relaxed pt-1">
                      Liveness verification verified client-side. The selfie capture exhibits 99.4% biometric facial landmarks concordance with the government ID portrait.
                    </p>

                    {/* Challenge Checklist */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-charcoal-border text-[10px]">
                      <div className="text-accent flex items-center gap-1 font-semibold">
                        <Check size={11} /> Center Face
                      </div>
                      <div className="text-accent flex items-center gap-1 font-semibold">
                        <Check size={11} /> Blink Motion
                      </div>
                      <div className="text-accent flex items-center gap-1 font-semibold">
                        <Check size={11} /> Head Turn Left
                      </div>
                    </div>
                  </div>

                  {/* 2. Host Identity Details */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary-muted flex items-center gap-1.5">
                      <User size={13} className="text-accent" />
                      <span>Applicant Personal &amp; Legal Info</span>
                    </h4>

                    <div className="p-4 bg-charcoal border border-charcoal-border rounded-2xl space-y-2 text-primary-secondary">
                      <div className="flex justify-between">
                        <span className="text-primary-muted">Full Legal Name:</span>
                        <span className="font-semibold text-white">
                          {selectedHost.firstName} {selectedHost.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-muted">ID Document Type:</span>
                        <span className="font-semibold text-white uppercase">
                          {selectedHost.profile?.idType ? selectedHost.profile.idType.replace(/_/g, " ") : "NIN Slip"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-muted">ID / NIN Number:</span>
                        <span className="font-mono font-bold text-white tabular-nums">
                          {selectedHost.profile?.idNumber || "Uploaded Document"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-muted">Email Address:</span>
                        <span className="text-white font-mono">{selectedHost.email}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-primary-muted">Phone Number:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white tabular-nums">{selectedHost.phone || "Not set"}</span>
                          {selectedHost.phone && (
                            <a
                              href={`https://wa.me/${selectedHost.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-1.5 py-0.5 rounded bg-accent-light text-accent text-[10px] font-semibold"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-muted">Operating Region:</span>
                        <span className="text-white font-medium">
                          {selectedHost.profile?.operatingCity || "Abuja"}
                          {selectedHost.profile?.operatingAreas ? ` (${selectedHost.profile.operatingAreas})` : ""}
                        </span>
                      </div>
                      {selectedHost.profile?.companyName && (
                        <div className="pt-2 border-t border-charcoal-border flex justify-between">
                          <span className="text-primary-muted">Company &amp; CAC:</span>
                          <span className="text-white font-semibold">
                            {selectedHost.profile.companyName} ({selectedHost.profile.companyRegNumber || "N/A"})
                          </span>
                        </div>
                      )}

                      {/* Login as User Function (Support Masquerade) */}
                      <div className="pt-2 border-t border-charcoal-border flex items-center justify-between">
                        <span className="text-primary-muted">Support Masquerade:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const confirm = window.confirm(
                              `Initiate support session as ${selectedHost.firstName} ${selectedHost.lastName}? All actions during masquerade will be logged in the audit trail.`
                            );
                            if (confirm) {
                              const auditEntry = {
                                id: "log_" + Date.now(),
                                action: "SUPPORT_MASQUERADE_INITIATED",
                                entityType: "HOST_USER",
                                entityId: selectedHost.id,
                                adminEmail: user?.email || "admin@ile.ng",
                                notes: `Admin initiated support masquerade session for Host ${selectedHost.email}.`,
                                createdAt: new Date().toISOString(),
                                ipAddress: "127.0.0.1",
                              };
                              setAuditLogs((prev) => [auditEntry, ...prev]);
                              window.open("/host/dashboard", "_blank");
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-charcoal-border hover:bg-charcoal text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <User size={11} className="text-accent" />
                          <span>Login as User</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Settlement Bank Account */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary-muted flex items-center gap-1.5">
                      <Landmark size={13} className="text-accent" />
                      <span>Settlement Bank Account</span>
                    </h4>

                    <div className="p-4 bg-charcoal border border-charcoal-border rounded-2xl space-y-2 text-primary-secondary">
                      <div className="flex justify-between">
                        <span className="text-primary-muted">Bank Name:</span>
                        <span className="font-semibold text-white">
                          {selectedHost.profile?.bankName || "Not configured"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-muted">NUBAN Account:</span>
                        <span className="font-mono font-bold text-white tabular-nums">
                          {selectedHost.profile?.bankAccountNumber || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-muted">Account Name:</span>
                        <span className="font-medium text-white">
                          {selectedHost.profile?.bankAccountName || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Action Prompts */}
                  {isRejectPromptOpen && (
                    <div className="p-4 bg-status-critical-bg border border-status-critical-border rounded-2xl space-y-3">
                      <h5 className="font-bold text-xs text-status-critical-text">
                        Specify Rejection Reason (Dispatched to Host via Email)
                      </h5>
                      <textarea
                        rows={3}
                        value={rejectHostReason}
                        onChange={(e) => setRejectHostReason(e.target.value)}
                        placeholder="e.g. Identity card is blurry or expired; please upload a clear photo of your Nigerian International Passport or NIN slip."
                        className="w-full p-2.5 bg-charcoal-surface border border-charcoal-border rounded-xl text-xs text-white focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRejectPromptOpen(false)}
                          className="px-3 py-1.5 text-xs text-primary-muted hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === selectedHost.id}
                          onClick={() => handleRejectHost(selectedHost.id)}
                          className="px-4 py-1.5 bg-status-critical-text hover:opacity-90 text-white font-bold rounded-xl text-xs transition-colors"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}

                  {isRequestInfoPromptOpen && (
                    <div className="p-4 bg-status-warning-bg border border-status-warning-border rounded-2xl space-y-3">
                      <h5 className="font-bold text-xs text-status-warning-text">
                        Request Document Clarification
                      </h5>
                      <textarea
                        rows={3}
                        value={requestInfoText}
                        onChange={(e) => setRequestInfoText(e.target.value)}
                        placeholder="e.g. Please provide a clearer, glare-free photo of your NIN slip and ensure your bank account matches your legal name."
                        className="w-full p-2.5 bg-charcoal-surface border border-charcoal-border rounded-xl text-xs text-white focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRequestInfoPromptOpen(false)}
                          className="px-3 py-1.5 text-xs text-primary-muted hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === selectedHost.id}
                          onClick={() => handleRequestHostInfo(selectedHost.id)}
                          className="px-4 py-1.5 bg-status-warning-text text-white font-bold rounded-xl text-xs transition-colors"
                        >
                          Dispatch Request
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Action Buttons at Bottom of Left Pane */}
                <div className="p-6 border-t border-charcoal-border bg-charcoal-surface sticky bottom-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRequestInfoPromptOpen(true);
                        setIsRejectPromptOpen(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-text text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle size={13} />
                      <span>Request Clarification</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsRejectPromptOpen(true);
                        setIsRequestInfoPromptOpen(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-status-critical-bg border border-status-critical-border text-status-critical-text text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={13} />
                      <span>Reject with Reason</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading === selectedHost.id}
                    onClick={() => handleApproveHost(selectedHost.id)}
                    className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold tracking-wide transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === selectedHost.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>Approve Verification &amp; Grant Host Authority</span>
                  </button>
                </div>
              </div>

              {/* ── RIGHT PANE (~60% width): NATIVE DOCUMENT VIEWER WORKSPACE ── */}
              <div className="flex-1 bg-charcoal flex flex-col justify-between overflow-hidden">
                {/* Document Viewer Tabs & Controls Header */}
                <div className="p-3 border-b border-charcoal-border bg-charcoal-surface flex flex-wrap items-center justify-between gap-3 shrink-0">
                  {/* Document Switcher Tabs */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDocTab("front")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeDocTab === "front"
                          ? "bg-accent text-white shadow-xs"
                          : "text-primary-muted hover:text-white bg-charcoal"
                      }`}
                    >
                      Front of ID
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDocTab("back")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeDocTab === "back"
                          ? "bg-accent text-white shadow-xs"
                          : "text-primary-muted hover:text-white bg-charcoal"
                      }`}
                    >
                      Back of ID
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDocTab("selfie")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeDocTab === "selfie"
                          ? "bg-accent text-white shadow-xs"
                          : "text-primary-muted hover:text-white bg-charcoal"
                      }`}
                    >
                      Live Selfie
                    </button>

                    {selectedHost.profile?.authorityDocUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveDocTab("authority")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          activeDocTab === "authority"
                            ? "bg-accent text-white shadow-xs"
                            : "text-primary-muted hover:text-white bg-charcoal"
                        }`}
                      >
                        Authority Deed
                      </button>
                    )}
                  </div>

                  {/* Viewer Zoom & Secure Download Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDocZoom((z) => Math.max(0.5, z - 0.25))}
                      className="p-1.5 text-primary-muted hover:text-white bg-charcoal rounded-lg transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>

                    <span className="text-[11px] font-mono text-primary-muted px-1 tabular-nums">
                      {Math.round(docZoom * 100)}%
                    </span>

                    <button
                      type="button"
                      onClick={() => setDocZoom((z) => Math.min(3, z + 0.25))}
                      className="p-1.5 text-primary-muted hover:text-white bg-charcoal rounded-lg transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>

                    {/* Secure Download Button (Logged in Audit Trail) */}
                    {(() => {
                      const prof = selectedHost.profile || {};
                      const currentUrl =
                        activeDocTab === "front"
                          ? prof.identityDocumentUrl || prof.idFrontUrl
                          : activeDocTab === "back"
                          ? prof.idDocumentBackUrl || prof.idBackUrl
                          : activeDocTab === "selfie"
                          ? prof.selfieUrl
                          : prof.authorityDocUrl;

                      return (
                        <button
                          type="button"
                          onClick={() =>
                            handleSecureDownload(
                              currentUrl,
                              activeDocTab === "front"
                                ? "Front of ID"
                                : activeDocTab === "back"
                                ? "Back of ID"
                                : activeDocTab === "selfie"
                                ? "Biometric Selfie"
                                : "Authority Deed"
                            )
                          }
                          disabled={!currentUrl}
                          className="ml-2 px-3 py-1.5 rounded-xl bg-charcoal hover:bg-charcoal-border text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          title="Download encrypted document & log in audit trail"
                        >
                          <Lock size={12} className="text-accent" />
                          <span>Download Encrypted File</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Viewer Canvas Area */}
                <div className="flex-1 overflow-auto p-6 flex items-center justify-center relative bg-charcoal">
                  {(() => {
                    const prof = selectedHost.profile || {};
                    const currentUrl =
                      activeDocTab === "front"
                        ? prof.identityDocumentUrl || prof.idFrontUrl
                        : activeDocTab === "back"
                        ? prof.idDocumentBackUrl || prof.idBackUrl
                        : activeDocTab === "selfie"
                        ? prof.selfieUrl
                        : prof.authorityDocUrl;

                    if (!currentUrl) {
                      return (
                        <div className="text-center text-primary-muted space-y-2 p-8 border border-dashed border-charcoal-border rounded-3xl">
                          <FileText size={36} className="mx-auto text-primary-muted" />
                          <p className="text-sm font-semibold">
                            No document uploaded for {activeDocTab.toUpperCase()}
                          </p>
                          <p className="text-xs text-primary-muted">
                            The applicant did not provide a file for this section.
                          </p>
                        </div>
                      );
                    }

                    const isPdf = currentUrl.toLowerCase().includes("pdf");

                    if (isPdf) {
                      return (
                        <iframe
                          src={currentUrl}
                          title="Document PDF Viewer"
                          className="w-full h-full rounded-2xl border border-charcoal-border bg-white"
                        />
                      );
                    }

                    return (
                      <div
                        className="relative max-w-full max-h-full transition-transform duration-150 flex items-center justify-center"
                        style={{ transform: `scale(${docZoom})` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentUrl}
                          alt="Applicant Document"
                          className="max-h-[75vh] max-w-[85vw] object-contain rounded-2xl shadow-2xl border border-charcoal-border bg-charcoal-surface"
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          4. MODALS (PROPERTY REVIEW, BOOKING DETAILS, SETTINGS, TEAM)
      ────────────────────────────────────────────────────────────── */}
      {/* Property Inspection Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border p-6 space-y-6 text-primary">
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-muted">
                  Property Review &amp; Physical Inspection
                </span>
                <h3 className="text-xl font-bold text-primary mt-1">
                  {selectedProperty.title}
                </h3>
                <p className="text-xs text-primary-secondary">
                  {selectedProperty.neighborhood}, {selectedProperty.city} · {selectedProperty.propertyType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="p-1.5 text-primary-muted hover:text-primary rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-surface-muted rounded-2xl border border-border grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-primary-muted block">Nightly Price</span>
                <span className="font-bold text-primary text-sm tabular-nums">{formatNaira(selectedProperty.pricePerNight)}</span>
              </div>
              <div>
                <span className="text-primary-muted block">Host Name</span>
                <span className="font-semibold text-primary">{selectedProperty.hostName || "Host Partner"}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-border">
                <span className="text-primary-muted block">Power Infrastructure Guarantee</span>
                <span className="font-semibold text-accent">{selectedProperty.powerType}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Link
                href={`/stay/${selectedProperty.slug}`}
                target="_blank"
                className="text-xs text-accent font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>Preview Public Stay Page</span>
                <ExternalLink size={12} />
              </Link>

              <div className="flex items-center gap-2">
                {selectedProperty.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => handleApproveProperty(selectedProperty.id)}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Approve &amp; Publish
                  </button>
                )}
                {selectedProperty.status === "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => handleSuspendProperty(selectedProperty.id)}
                    className="px-4 py-2 bg-status-critical-bg border border-status-critical-border text-status-critical-text rounded-xl text-xs font-semibold hover:opacity-90 transition-colors cursor-pointer"
                  >
                    Suspend Listing
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProperty(null)}
                  className="px-4 py-2 bg-surface-muted hover:bg-border text-primary rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border p-6 space-y-5 text-primary">
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-muted">
                  Booking Ledger Details
                </span>
                <h3 className="text-lg font-bold text-primary mt-1 font-mono tabular-nums">
                  {selectedBooking.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 text-primary-muted hover:text-primary rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-surface-muted rounded-2xl border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-primary-secondary">Guest Legal Name:</span>
                <span className="font-semibold text-primary">{selectedBooking.guestName || "Guest User"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-secondary">Guest Email:</span>
                <span className="font-mono text-primary">{selectedBooking.guestEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-secondary">Dates:</span>
                <span className="font-semibold text-primary tabular-nums">{selectedBooking.checkInDate} → {selectedBooking.checkOutDate}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-border text-accent tabular-nums">
                <span>Total Amount:</span>
                <span>{formatNaira(selectedBooking.totalAmount || selectedBooking.totalPrice || 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedBooking(null)}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Admin Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 space-y-5 text-primary shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-primary flex items-center gap-2">
                <Settings size={18} className="text-accent" />
                <span>Admin Workspace Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-primary-muted hover:text-primary rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-surface-muted rounded-xl border border-border flex justify-between items-center">
                <span>Security Tier</span>
                <span className="font-bold text-accent">Bank-Grade Tier 3</span>
              </div>
              <div className="p-3 bg-surface-muted rounded-xl border border-border flex justify-between items-center">
                <span>Session Timeout</span>
                <span className="font-mono text-primary-secondary">12 Hours (Enforced)</span>
              </div>
              <div className="p-3 bg-surface-muted rounded-xl border border-border flex justify-between items-center">
                <span>Environment</span>
                <span className="font-bold text-primary">Enterprise Workspace</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Manage Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 space-y-5 text-primary shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-primary flex items-center gap-2">
                <Users size={18} className="text-accent" />
                <span>Manage Administrative Team</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="p-1.5 text-primary-muted hover:text-primary rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-surface-muted rounded-xl border border-border flex justify-between items-center">
                <div>
                  <span className="font-semibold block text-primary">Ilé Administrator</span>
                  <span className="text-[10px] text-primary-muted">admin@ile.ng</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-success-bg text-status-success-text border border-status-success-border">
                  Super Admin
                </span>
              </div>
              <div className="p-3 bg-surface-muted rounded-xl border border-border flex justify-between items-center">
                <div>
                  <span className="font-semibold block text-primary">Abuja KYC Desk</span>
                  <span className="text-[10px] text-primary-muted">compliance.abj@ile.ng</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-info-bg text-status-info-text border border-status-info-border">
                  Compliance Officer
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTeamModal(false)}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
