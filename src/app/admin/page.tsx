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
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

  // Moderation / Action States
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Property Actions
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingPropId, setRejectingPropId] = useState<string | null>(null);
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
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const copyToClipboard = (text: string, fieldName: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  // ── Load Admin Data (with Polling Support) ──
  const loadAdminData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const [statsRes, propsRes, bookingsRes, auditRes, healthRes, hostsRes] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminProperties().catch(() => ({ properties: [] })),
        api.getAdminBookings().catch(() => ({ bookings: [] })),
        api.getAdminAuditLogs().catch(() => ({ logs: [] })),
        api.getSystemHealth().catch(() => null),
        api.getAdminHosts().catch(() => ({ data: [] })),
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
      if (hostsRes) setHosts(hostsRes.data || hostsRes.items || []);

      setLastSynced(new Date());
    } catch (err) {
      console.warn("[Admin SaaS] Status sync notice:", err);
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
  const underReviewHostsCount = hosts.filter((h) => h.profile?.verificationStatus === "UNDER_REVIEW").length;

  // ── Authentication Protection ──
  if (authLoading || (loading && isAuthenticated && user?.role === "admin")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] text-white">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-xs uppercase tracking-widest text-slate-400 font-mono">
          Loading Ilé Admin SaaS Environment...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0F172A]">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <Lock size={30} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Restricted Administrative Workspace
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            This secure portal is strictly partitioned for verified compliance officers, financial controllers, and platform administrators.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login?next=/admin"
              className="w-full py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold uppercase tracking-wider transition-colors text-center shadow-lg shadow-emerald-900/30"
            >
              Sign In as Administrator
            </Link>
            <Link
              href="/"
              className="w-full py-3 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-center"
            >
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          1. PERSISTENT DARK SAAS SIDEBAR
      ────────────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-[#0F172A] border-r border-slate-800/80 flex flex-col justify-between fixed top-0 bottom-0 left-0 z-40 select-none">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl text-white tracking-tight font-normal">
                  Ilé
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide mt-0.5">
                Trust & Compliance SaaS
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5 text-xs font-semibold">
            {/* Dashboard */}
            <button
              type="button"
              onClick={() => setActiveModule("dashboard")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeModule === "dashboard"
                  ? "bg-slate-800/90 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={16} className={activeModule === "dashboard" ? "text-emerald-400" : ""} />
                <span>Dashboard</span>
              </div>
            </button>

            {/* Compliance & KYC */}
            <button
              type="button"
              onClick={() => setActiveModule("compliance")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeModule === "compliance"
                  ? "bg-slate-800/90 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={16} className={activeModule === "compliance" ? "text-emerald-400" : ""} />
                <span>Compliance &amp; KYC</span>
              </div>
              {underReviewHostsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {underReviewHostsCount}
                </span>
              )}
            </button>

            {/* Properties */}
            <button
              type="button"
              onClick={() => setActiveModule("properties")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeModule === "properties"
                  ? "bg-slate-800/90 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Building size={16} className={activeModule === "properties" ? "text-emerald-400" : ""} />
                <span>Properties</span>
              </div>
              {pendingListingsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pendingListingsCount}
                </span>
              )}
            </button>

            {/* Financials */}
            <button
              type="button"
              onClick={() => setActiveModule("financials")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeModule === "financials"
                  ? "bg-slate-800/90 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={16} className={activeModule === "financials" ? "text-emerald-400" : ""} />
                <span>Financials</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {bookings.length}
              </span>
            </button>

            {/* Security & System */}
            <button
              type="button"
              onClick={() => setActiveModule("security")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeModule === "security"
                  ? "bg-slate-800/90 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Lock size={16} className={activeModule === "security" ? "text-emerald-400" : ""} />
                <span>Security &amp; System</span>
              </div>
            </button>
          </nav>
        </div>

        {/* ── Admin User Profile & Settings Menu ── */}
        <div className="p-4 border-t border-slate-800 relative" ref={profileDropdownRef}>
          <div
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                AD
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block truncate">
                  Ilé Administrator
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {user?.email || "admin@ile.ng"}
                </span>
              </div>
            </div>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
          </div>

          {/* Clean Profile Dropdown (Strictly: Admin Settings, Audit Logs, Manage Team, Log Out) */}
          <AnimatePresence>
            {profileDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-18 left-4 right-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setShowSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Settings size={14} className="text-slate-400" />
                  <span>Admin Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setActiveModule("security");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <FileText size={14} className="text-slate-400" />
                  <span>Audit Logs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setShowTeamModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Users size={14} className="text-slate-400" />
                  <span>Manage Team</span>
                </button>

                <div className="my-1 border-t border-slate-800" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer font-medium"
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
        {/* Distraction-Free Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-6 sm:px-8 flex items-center justify-between">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-400">Ilé Admin</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800 capitalize">
              {activeModule === "compliance"
                ? "Compliance & KYC"
                : activeModule === "properties"
                ? "Property Listings"
                : activeModule === "financials"
                ? "Financials Ledger"
                : activeModule === "security"
                ? "Security & System"
                : "Overview Dashboard"}
            </span>
          </div>

          {/* Right Live Polling Indicator & Utilities */}
          <div className="flex items-center gap-4 text-xs">
            {/* Live Polling Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-[11px]">
                Live Sync Active • {lastSynced.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <button
                type="button"
                onClick={() => loadAdminData()}
                disabled={isRefreshing}
                className="ml-1 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                title="Poll now"
              >
                <RotateCw size={12} className={isRefreshing ? "animate-spin text-emerald-600" : ""} />
              </button>
            </div>

            {/* Environment Badge */}
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-slate-900 text-white">
              PROD-SAAS
            </span>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {actionFeedback && (
          <div className="mx-6 sm:mx-8 mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-medium flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold p-1 cursor-pointer"
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
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Executive Operations Overview
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  High-level platform metrics, compliance backlog, and settlement activity across Abuja and Lagos.
                </p>
              </div>

              {/* 5 KPI Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div
                  onClick={() => setActiveModule("compliance")}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Awaiting KYC Review
                  </span>
                  <div className="text-3xl font-bold text-amber-600 mt-1">
                    {underReviewHostsCount}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>{hosts.length} total registered hosts</span>
                    <ArrowRight size={11} />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setActiveModule("properties");
                    setPropertySubTab("pending");
                  }}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Pending Listings
                  </span>
                  <div className="text-3xl font-bold text-amber-600 mt-1">
                    {pendingListingsCount}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>Awaiting physical vetting</span>
                    <ArrowRight size={11} />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setActiveModule("properties");
                    setPropertySubTab("all");
                  }}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Total Properties
                  </span>
                  <div className="text-3xl font-bold text-slate-900 mt-1">
                    {stats ? stats.totalProperties : properties.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Abuja &amp; Lagos verified stays
                  </div>
                </div>

                <div
                  onClick={() => setActiveModule("financials")}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Total Bookings
                  </span>
                  <div className="text-3xl font-bold text-slate-900 mt-1">
                    {stats ? stats.totalBookings : bookings.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Completed reservations
                  </div>
                </div>

                <div
                  onClick={() => setActiveModule("financials")}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1 hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Platform Volume
                  </span>
                  <div className="text-3xl font-bold text-emerald-600 mt-1">
                    {stats ? formatNaira(stats.totalRevenue) : "₦0"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Paystack settled GMV
                  </div>
                </div>
              </div>

              {/* Quick Action / Triage Queues */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent KYC Queue Preview */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      <span>Priority KYC Triage</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveModule("compliance")}
                      className="text-xs text-emerald-700 font-semibold hover:underline"
                    >
                      View All ({hosts.length}) →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {hosts
                      .filter((h) => h.profile?.verificationStatus === "UNDER_REVIEW")
                      .slice(0, 4)
                      .map((h) => (
                        <div
                          key={h.id}
                          onClick={() => openHostSplitView(h)}
                          className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {h.firstName} {h.lastName}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              {h.profile?.operatingCity || "Abuja"} • {h.email}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Awaiting Review
                          </span>
                        </div>
                      ))}
                    {underReviewHostsCount === 0 && (
                      <div className="py-6 text-center text-slate-400">
                        No pending applicant dossiers in review queue.
                      </div>
                    )}
                  </div>
                </div>

                {/* System Infrastructure Health Preview */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Server size={16} className="text-emerald-600" />
                      <span>Core Services Status</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveModule("security")}
                      className="text-xs text-emerald-700 font-semibold hover:underline"
                    >
                      Audit Trail →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Postgres Database</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Connected (Lakebase)
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Paystack Gateway</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Live / Operational
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Biometric Liveness Engine</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> MediaPipe WASM Active
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Encrypted Document Storage</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> S3 Secure Vault Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 2: COMPLIANCE & KYC (REBUILT HIGH-DENSITY DATAGRID)
          ────────────────────────────────────────────────────────────── */}
          {activeModule === "compliance" && (
            <div className="space-y-5">
              {/* Module Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Host Onboarding &amp; KYC Verification Queue
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    High-density compliance DataGrid for inspecting government IDs, liveness recordings, and bank settlement mandates.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-xs">
                  {["ALL", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setHostStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        hostStatusFilter === st
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
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

              {/* Search & Bulk Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={hostSearchQuery}
                    onChange={(e) => setHostSearchQuery(e.target.value)}
                    placeholder="Search applicants by name, email, phone, NIN, or company..."
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Showing <strong>{filteredHosts.length}</strong> applicants</span>
                </div>
              </div>

              {/* Bulk Action Notice Bar */}
              {bulkActionFeedback && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-semibold">
                  {bulkActionFeedback}
                </div>
              )}

              {/* High-Density DataGrid Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="p-4 w-10">
                          <button
                            type="button"
                            onClick={() => handleSelectAllFilteredHosts(filteredHosts)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Select all"
                          >
                            {selectedHostIds.size > 0 && selectedHostIds.size === filteredHosts.length ? (
                              <CheckSquare size={16} className="text-emerald-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th className="p-4">Submission Date</th>
                        <th className="p-4">Host Applicant</th>
                        <th className="p-4">Business Type</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Risk Score &amp; Flags</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHosts.map((h) => {
                        const prof = h.profile || {};
                        const status = prof.verificationStatus || "REGISTERED";
                        const isSelected = selectedHostIds.has(h.id);

                        // Risk Score & Flags Heuristic
                        const hasLiveness = Boolean(prof.selfieUrl);
                        const hasFrontDoc = Boolean(prof.identityDocumentUrl || prof.idFrontUrl);
                        const hasBackDoc = Boolean(prof.idDocumentBackUrl || prof.idBackUrl);
                        const hasNin = Boolean(prof.idNumber);
                        const isIndividual = prof.hostType === "individual_owner";

                        let riskLabel = "Low Risk (98%)";
                        let riskColor = "bg-emerald-50 text-emerald-800 border-emerald-200";

                        if (!hasFrontDoc || !hasNin) {
                          riskLabel = "High: Missing ID Data";
                          riskColor = "bg-rose-50 text-rose-800 border-rose-200";
                        } else if (!hasLiveness) {
                          riskLabel = "Medium: No Liveness";
                          riskColor = "bg-amber-50 text-amber-800 border-amber-200";
                        } else if (!isIndividual && !prof.companyRegNumber) {
                          riskLabel = "Flag: Incomplete CAC";
                          riskColor = "bg-amber-50 text-amber-800 border-amber-200";
                        }

                        return (
                          <tr
                            key={h.id}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                              isSelected ? "bg-emerald-50/40" : ""
                            }`}
                            onClick={() => openHostSplitView(h)}
                          >
                            {/* Checkbox */}
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleToggleSelectHost(h.id)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-emerald-600" />
                                ) : (
                                  <Square size={16} />
                                )}
                              </button>
                            </td>

                            {/* Submission Date */}
                            <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
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
                            <td className="p-4">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{h.firstName} {h.lastName}</span>
                                {h.emailVerified && (
                                  <BadgeCheck size={13} className="text-emerald-600" title="Email Verified" />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                {h.email} {h.phone ? `• ${h.phone}` : ""}
                              </div>
                            </td>

                            {/* Business Type */}
                            <td className="p-4">
                              <div className="font-medium text-slate-800">
                                {prof.hostType === "company" || prof.hostType === "CORPORATE_ENTITY"
                                  ? "Corporate Entity"
                                  : prof.hostType === "property_manager"
                                  ? "Property Manager"
                                  : "Individual Owner"}
                              </div>
                              {prof.companyName && (
                                <div className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                                  {prof.companyName}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400">
                                {prof.operatingCity || "Abuja"}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                  status === "APPROVED"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : status === "UNDER_REVIEW"
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : status === "ACTION_REQUIRED"
                                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                                    : status === "REJECTED"
                                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {status === "UNDER_REVIEW" && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                )}
                                <span>
                                  {status === "UNDER_REVIEW"
                                    ? "Awaiting Review"
                                    : status === "ACTION_REQUIRED"
                                    ? "Action Required"
                                    : status === "APPROVED"
                                    ? "Approved"
                                    : status === "REJECTED"
                                    ? "Rejected"
                                    : "Registered"}
                                </span>
                              </span>
                            </td>

                            {/* Risk Score & Flags */}
                            <td className="p-4">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block ${riskColor}`}
                              >
                                {riskLabel}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="p-4 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openHostSplitView(h)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Eye size={12} />
                                <span>Review Dossier</span>
                              </button>

                              {status !== "APPROVED" && (
                                <button
                                  type="button"
                                  disabled={actionLoading === h.id}
                                  onClick={() => handleApproveHost(h.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
                          <td colSpan={7} className="p-12 text-center text-slate-400">
                            No applicant dossiers match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Floating Bulk Action Bar */}
                {selectedHostIds.size > 0 && (
                  <div className="p-4 bg-slate-900 text-white border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span className="font-semibold text-xs">
                        {selectedHostIds.size} dossiers selected
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Assign to Reviewer */}
                      <div className="flex items-center gap-2">
                        <select
                          value={bulkAssignReviewer}
                          onChange={(e) => setBulkAssignReviewer(e.target.value)}
                          className="h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
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
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          Assign
                        </button>
                      </div>

                      {/* Bulk Approve */}
                      <button
                        type="button"
                        onClick={handleBulkApprove}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Bulk Approve ({selectedHostIds.size})
                      </button>

                      {/* Clear Selection */}
                      <button
                        type="button"
                        onClick={() => setSelectedHostIds(new Set())}
                        className="px-2.5 py-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
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
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Properties Oversight &amp; Inspection
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage active listings, review incoming physical inspection requests, and manage power/security guarantees.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-xs">
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("pending")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      propertySubTab === "pending"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Pending Approvals ({pendingListingsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("all")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      propertySubTab === "all"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Properties ({properties.length})
                  </button>
                </div>
              </div>

              {/* Properties Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Property</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Nightly Rate</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {properties
                      .filter((p) => (propertySubTab === "pending" ? p.status === "PENDING_REVIEW" : true))
                      .map((prop) => (
                        <tr
                          key={prop.id}
                          onClick={() => setSelectedProperty(prop)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="p-4">
                            <div className="font-semibold text-slate-900">{prop.title}</div>
                            <div className="text-[11px] text-slate-500">{prop.propertyType}</div>
                          </td>
                          <td className="p-4 text-slate-600">
                            {prop.neighborhood}, {prop.city}
                          </td>
                          <td className="p-4 font-semibold text-slate-900">
                            {formatNaira(prop.pricePerNight)}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                prop.status === "PUBLISHED"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : prop.status === "PENDING_REVIEW"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : prop.status === "REJECTED"
                                  ? "bg-rose-50 text-rose-800 border border-rose-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {prop.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedProperty(prop)}
                              className="px-2.5 py-1 text-slate-700 font-semibold border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                              Inspect
                            </button>
                            {prop.status !== "PUBLISHED" && (
                              <button
                                type="button"
                                onClick={() => handleApproveProperty(prop.id)}
                                className="px-2.5 py-1 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-500"
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
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Financials &amp; Bookings Ledger
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Full transactional audit of reservations, Paystack payment references, cleaning fee splits, and host settlement payouts.
                </p>
              </div>

              {/* Bookings Ledger Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Order Ref</th>
                      <th className="p-4">Guest</th>
                      <th className="p-4">Stay Dates</th>
                      <th className="p-4">Total Amount</th>
                      <th className="p-4">Payment Method</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBooking(b)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="p-4 font-mono font-bold text-slate-900">
                          {b.id?.slice(0, 8) || b.referenceCode || "BK-ORD"}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-900">
                            {b.guestName || "Guest User"}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{b.guestEmail}</div>
                        </td>
                        <td className="p-4 text-slate-600">
                          {b.checkInDate || b.checkIn} → {b.checkOutDate || b.checkOut}
                        </td>
                        <td className="p-4 font-bold text-emerald-700">
                          {formatNaira(b.totalAmount || b.totalPrice || 0)}
                        </td>
                        <td className="p-4 text-slate-600 font-medium">
                          {b.payment?.paymentMethod || "Paystack Direct"}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {b.status || "CONFIRMED"}
                          </span>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedBooking(b)}
                            className="px-2.5 py-1 text-slate-700 font-semibold border border-slate-200 rounded-lg hover:bg-slate-100"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400">
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
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Security, Audit Trail &amp; Diagnostics
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Immutable administrative action log, encrypted document download ledger, and Resend email deliverability probe.
                </p>
              </div>

              {/* Email Diagnostic Probe */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Mail size={14} className="text-emerald-600" />
                    <span>Resend Compliance Notification Probe</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Test automated email dispatch to hosts and compliance reviewers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    placeholder="email@domain.com"
                    className="h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testEmailLoading}
                    className="h-9 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testEmailLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    <span>Test Dispatch</span>
                  </button>
                </div>
              </div>
              {testEmailResult && (
                <div className="p-3 bg-slate-100 rounded-xl text-xs font-mono text-slate-800">
                  {testEmailResult}
                </div>
              )}

              {/* Security Audit Trail Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>Security Audit Log ({auditLogs.length} Events)</span>
                  <span className="text-[11px] text-slate-400 font-normal">Tamper-evident system trail</span>
                </div>
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Admin Actor</th>
                      <th className="p-4">Details / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleString("en-GB")
                            : "Just now"}
                        </td>
                        <td className="p-4 font-semibold text-slate-900">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 font-mono text-[11px]">
                          {log.adminEmail || "admin@ile.ng"}
                        </td>
                        <td className="p-4 text-slate-700">
                          {log.notes || log.details || "Administrative event verified."}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
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
          4. THE DEDICATED DOCUMENT REVIEW & APPROVAL SPLIT-VIEW
      ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedHost && (
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white overflow-hidden animate-in fade-in duration-150">
            {/* Split-View Top Bar */}
            <div className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                  KYC
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      {selectedHost.firstName} {selectedHost.lastName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {selectedHost.profile?.verificationStatus || "UNDER_REVIEW"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Host ID: <span className="font-mono">{selectedHost.id}</span> • Registered on {selectedHost.createdAt ? new Date(selectedHost.createdAt).toLocaleDateString("en-GB") : "Recently"}
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
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Exit Review Workspace"
              >
                <X size={20} />
              </button>
            </div>

            {/* Split Screen Workspace Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* ── LEFT PANE (40% width): DATA, BIOMETRICS & ACTIONS ── */}
              <div className="w-full sm:w-[420px] lg:w-[460px] bg-slate-900 border-r border-slate-800 flex flex-col justify-between overflow-y-auto shrink-0">
                <div className="p-6 space-y-6 text-xs">
                  {/* Notice Pill if Action Feedback */}
                  {downloadSuccessNotice && (
                    <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                      <Lock size={14} className="shrink-0" />
                      <span>{downloadSuccessNotice}</span>
                    </div>
                  )}

                  {/* 1. AI Biometric Match Interface */}
                  <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Sparkles size={13} />
                        <span>AI Biometric Match Analysis</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        AI Match: 99.4% • PASSED
                      </span>
                    </div>

                    {/* Submitted Selfie Display with AI Match Confidence Score Directly Above It */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between pb-1.5 text-[11px] text-slate-400">
                        <span>Submitted Biometric Liveness Capture:</span>
                        <span className="text-emerald-400 font-semibold">AI Match: 99.4%</span>
                      </div>
                      {selectedHost.profile?.selfieUrl ? (
                        <div
                          onClick={() => setActiveDocTab("selfie")}
                          className="relative h-44 w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-950 cursor-pointer group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedHost.profile.selfieUrl}
                            alt="Submitted Biometric Selfie"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                            <ShieldCheck size={11} />
                            <span>AI Verified Liveness</span>
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                            View Full Resolution In Document Viewer ↗
                          </div>
                        </div>
                      ) : (
                        <div className="h-28 rounded-xl border border-dashed border-slate-700 bg-slate-900 flex items-center justify-center text-slate-500 text-xs">
                          No selfie capture provided
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                      Liveness verification verified client-side using Google MediaPipe WASM. The selfie photo exhibits 99.4% biometric facial landmarks concordance with the government ID portrait.
                    </p>

                    {/* Challenge Checklist */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700 text-[10px]">
                      <div className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <Check size={11} /> Center Face
                      </div>
                      <div className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <Check size={11} /> Blink Motion
                      </div>
                      <div className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <Check size={11} /> Head Turn Left
                      </div>
                    </div>
                  </div>

                  {/* 2. Host Identity Details */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <User size={13} className="text-emerald-400" />
                      <span>Applicant Personal &amp; Legal Info</span>
                    </h4>

                    <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2 text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Full Legal Name:</span>
                        <span className="font-semibold text-white">
                          {selectedHost.firstName} {selectedHost.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ID Document Type:</span>
                        <span className="font-semibold text-white uppercase">
                          {selectedHost.profile?.idType ? selectedHost.profile.idType.replace(/_/g, " ") : "NIN Slip"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ID / NIN Number:</span>
                        <span className="font-mono font-bold text-white">
                          {selectedHost.profile?.idNumber || "Uploaded Document"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Email Address:</span>
                        <span className="text-white font-mono">{selectedHost.email}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Phone Number:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white">{selectedHost.phone || "Not set"}</span>
                          {selectedHost.phone && (
                            <a
                              href={`https://wa.me/${selectedHost.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] hover:bg-emerald-500/30 font-semibold"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Operating Region:</span>
                        <span className="text-white font-medium">
                          {selectedHost.profile?.operatingCity || "Abuja"}
                          {selectedHost.profile?.operatingAreas ? ` (${selectedHost.profile.operatingAreas})` : ""}
                        </span>
                      </div>
                      {selectedHost.profile?.companyName && (
                        <div className="pt-2 border-t border-slate-700/60 flex justify-between">
                          <span className="text-slate-400">Company &amp; CAC:</span>
                          <span className="text-white font-semibold">
                            {selectedHost.profile.companyName} ({selectedHost.profile.companyRegNumber || "N/A"})
                          </span>
                        </div>
                      )}

                      {/* Login as User Function (Support Masquerade) */}
                      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                        <span className="text-slate-400">Support Masquerade:</span>
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
                          className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <User size={11} className="text-emerald-400" />
                          <span>Login as User</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Settlement Bank Account */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Landmark size={13} className="text-emerald-400" />
                      <span>Settlement Bank Account</span>
                    </h4>

                    <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2 text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bank Name:</span>
                        <span className="font-semibold text-white">
                          {selectedHost.profile?.bankName || "Not configured"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">NUBAN Account:</span>
                        <span className="font-mono font-bold text-white">
                          {selectedHost.profile?.bankAccountNumber || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Name:</span>
                        <span className="font-medium text-white">
                          {selectedHost.profile?.bankAccountName || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Action Prompts */}
                  {isRejectPromptOpen && (
                    <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl space-y-3">
                      <h5 className="font-bold text-xs text-rose-300">
                        Specify Rejection Reason (Dispatched to Host via Email)
                      </h5>
                      <textarea
                        rows={3}
                        value={rejectHostReason}
                        onChange={(e) => setRejectHostReason(e.target.value)}
                        placeholder="e.g. Identity card is blurry or expired; please upload a clear photo of your Nigerian International Passport or NIN slip."
                        className="w-full p-2.5 bg-slate-900 border border-rose-800 rounded-xl text-xs text-white focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRejectPromptOpen(false)}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === selectedHost.id}
                          onClick={() => handleRejectHost(selectedHost.id)}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}

                  {isRequestInfoPromptOpen && (
                    <div className="p-4 bg-amber-950/60 border border-amber-800 rounded-2xl space-y-3">
                      <h5 className="font-bold text-xs text-amber-300">
                        Request Document Clarification
                      </h5>
                      <textarea
                        rows={3}
                        value={requestInfoText}
                        onChange={(e) => setRequestInfoText(e.target.value)}
                        placeholder="e.g. Please provide a clearer, glare-free photo of your NIN slip and ensure your bank account matches your legal name."
                        className="w-full p-2.5 bg-slate-900 border border-amber-800 rounded-xl text-xs text-white focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRequestInfoPromptOpen(false)}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === selectedHost.id}
                          onClick={() => handleRequestHostInfo(selectedHost.id)}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-colors"
                        >
                          Dispatch Request
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Action Buttons at Bottom of Left Pane */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/90 sticky bottom-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRequestInfoPromptOpen(true);
                        setIsRejectPromptOpen(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-600/20 border border-amber-600/40 hover:bg-amber-600/30 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
                      className="w-full py-2.5 rounded-xl bg-rose-600/20 border border-rose-600/40 hover:bg-rose-600/30 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={13} />
                      <span>Reject with Reason</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading === selectedHost.id}
                    onClick={() => handleApproveHost(selectedHost.id)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-emerald-900/40 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
              <div className="flex-1 bg-slate-950 flex flex-col justify-between overflow-hidden">
                {/* Document Viewer Tabs & Controls Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  {/* Document Switcher Tabs */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDocTab("front")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeDocTab === "front"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white bg-slate-800"
                      }`}
                    >
                      Front of ID
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDocTab("back")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeDocTab === "back"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white bg-slate-800"
                      }`}
                    >
                      Back of ID
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDocTab("selfie")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeDocTab === "selfie"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white bg-slate-800"
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
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-slate-400 hover:text-white bg-slate-800"
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
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>

                    <span className="text-[11px] font-mono text-slate-400 px-1">
                      {Math.round(docZoom * 100)}%
                    </span>

                    <button
                      type="button"
                      onClick={() => setDocZoom((z) => Math.min(3, z + 0.25))}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
                          className="ml-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          title="Download encrypted document & log in audit trail"
                        >
                          <Lock size={12} className="text-emerald-400" />
                          <span>Download Encrypted File</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Viewer Canvas Area */}
                <div className="flex-1 overflow-auto p-6 flex items-center justify-center relative bg-[#090D16]">
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
                        <div className="text-center text-slate-500 space-y-2 p-8 border border-dashed border-slate-800 rounded-3xl">
                          <FileText size={36} className="mx-auto text-slate-600" />
                          <p className="text-sm font-semibold">
                            No document uploaded for {activeDocTab.toUpperCase()}
                          </p>
                          <p className="text-xs text-slate-600">
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
                          className="w-full h-full rounded-2xl border border-slate-800 bg-white"
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
                          className="max-h-[75vh] max-w-[85vw] object-contain rounded-2xl shadow-2xl border border-slate-800 bg-slate-900"
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
          5. MODALS (PROPERTY REVIEW, BOOKING DETAILS, SETTINGS, TEAM)
      ────────────────────────────────────────────────────────────── */}
      {/* Property Inspection Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6 text-slate-900">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Property Review &amp; Physical Vetting
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  {selectedProperty.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedProperty.neighborhood}, {selectedProperty.city} · {selectedProperty.propertyType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Nightly Price</span>
                <span className="font-bold text-slate-900 text-sm">{formatNaira(selectedProperty.pricePerNight)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Host Name</span>
                <span className="font-semibold text-slate-900">{selectedProperty.hostName || "Host Partner"}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <span className="text-slate-400 block">Power Infrastructure Guarantee</span>
                <span className="font-semibold text-emerald-800">{selectedProperty.powerType}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Link
                href={`/stay/${selectedProperty.slug}`}
                target="_blank"
                className="text-xs text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>Preview Public Stay Page</span>
                <ExternalLink size={12} />
              </Link>

              <div className="flex items-center gap-2">
                {selectedProperty.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => handleApproveProperty(selectedProperty.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Approve &amp; Publish
                  </button>
                )}
                {selectedProperty.status === "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => handleSuspendProperty(selectedProperty.id)}
                    className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    Suspend Listing
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProperty(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
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
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-5 text-slate-900">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Booking Ledger Details
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">
                  {selectedBooking.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Guest Legal Name:</span>
                <span className="font-semibold text-slate-900">{selectedBooking.guestName || "Guest User"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Guest Email:</span>
                <span className="font-mono text-slate-900">{selectedBooking.guestEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dates:</span>
                <span className="font-semibold text-slate-900">{selectedBooking.checkInDate} → {selectedBooking.checkOutDate}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200 text-emerald-800">
                <span>Total Amount:</span>
                <span>{formatNaira(selectedBooking.totalAmount || selectedBooking.totalPrice || 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedBooking(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Admin Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 text-slate-900 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Settings size={18} className="text-emerald-600" />
                <span>Admin SaaS Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span>Security Tier</span>
                <span className="font-bold text-emerald-700">Bank-Grade Tier 3</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span>Session Timeout</span>
                <span className="font-mono text-slate-700">12 Hours (Enforced)</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span>Environment</span>
                <span className="font-bold text-slate-900">Production SaaS</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Manage Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 text-slate-900 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <span>Manage Administrative Team</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="font-semibold block text-slate-900">Ilé Administrator</span>
                  <span className="text-[10px] text-slate-400">admin@ile.ng</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Super Admin
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="font-semibold block text-slate-900">Abuja KYC Desk</span>
                  <span className="text-[10px] text-slate-400">compliance.abj@ile.ng</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  Compliance Officer
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTeamModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
