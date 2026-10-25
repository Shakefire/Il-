"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ShieldCheck,
  RefreshCw,
  Lock,
} from "lucide-react";
import { maskAccountNumber } from "@/lib/utils";

export interface PaystackBankOption {
  name: string;
  code: string;
  slug: string;
  type?: string;
}

export interface BankAccountValue {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isResolved: boolean;
  isConfirmed: boolean;
}

export interface BankAccountInputProps {
  initialBankCode?: string;
  initialBankName?: string;
  initialAccountNumber?: string;
  initialAccountName?: string;
  onChange?: (val: BankAccountValue) => void;
  showConfirmationStep?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function BankAccountInput({
  initialBankCode = "",
  initialBankName = "",
  initialAccountNumber = "",
  initialAccountName = "",
  onChange,
  showConfirmationStep = true,
  disabled = false,
  className = "",
}: BankAccountInputProps) {
  // Banks list state
  const [banks, setBanks] = useState<PaystackBankOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [bankLoadError, setBankLoadError] = useState<string | null>(null);

  // Searchable dropdown state
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected bank state
  const [selectedBankCode, setSelectedBankCode] = useState(initialBankCode);
  const [selectedBankName, setSelectedBankName] = useState(initialBankName);

  // Account number state
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber);
  const [touchedAccount, setTouchedAccount] = useState(false);

  // Resolution state
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(
    initialAccountName || null
  );
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolved, setIsResolved] = useState(Boolean(initialAccountName));

  // Confirmation state
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Abort controller ref to cancel stale requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBankDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch supported banks on mount
  const fetchBanks = useCallback(async () => {
    setLoadingBanks(true);
    setBankLoadError(null);
    try {
      const res = await fetch("/api/banks");
      const data = await res.json();
      if (!res.ok || !data.banks) {
        throw new Error(data.error || "Failed to load banks");
      }
      setBanks(data.banks);

      // If initialBankCode or initialBankName provided, match it
      if (initialBankCode) {
        const found = data.banks.find((b: PaystackBankOption) => b.code === initialBankCode);
        if (found) {
          setSelectedBankName(found.name);
        }
      } else if (initialBankName) {
        const found = data.banks.find(
          (b: PaystackBankOption) => b.name.toLowerCase() === initialBankName.toLowerCase()
        );
        if (found) {
          setSelectedBankCode(found.code);
        }
      }
    } catch (err: any) {
      console.warn("[BankAccountInput] Failed to fetch bank list:", err.message);
      setBankLoadError("Could not load Nigerian banks. Tap to retry.");
    } finally {
      setLoadingBanks(false);
    }
  }, [initialBankCode, initialBankName]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  // Notify parent of state changes
  useEffect(() => {
    onChange?.({
      bankName: selectedBankName,
      bankCode: selectedBankCode,
      accountNumber,
      accountName: resolvedAccountName || "",
      isResolved,
      isConfirmed: showConfirmationStep ? isConfirmed : isResolved,
    });
  }, [
    selectedBankName,
    selectedBankCode,
    accountNumber,
    resolvedAccountName,
    isResolved,
    isConfirmed,
    showConfirmationStep,
    onChange,
  ]);

  // Debounced NUBAN Account Resolution via Paystack
  useEffect(() => {
    const cleanedAcc = accountNumber.replace(/\D/g, "");

    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Must have 10 digits and a selected bank
    if (cleanedAcc.length !== 10 || !selectedBankCode) {
      setIsResolving(false);
      return;
    }

    // If already resolved for these exact values, no need to re-fetch
    if (isResolved && resolvedAccountName) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsResolving(true);
      setResolveError(null);
      setResolvedAccountName(null);
      setIsResolved(false);
      setIsConfirmed(false);

      try {
        const res = await fetch("/api/bank-accounts/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountNumber: cleanedAcc,
            bankCode: selectedBankCode,
          }),
          signal: controller.signal,
        });

        const body = await res.json();

        if (controller.signal.aborted) return;

        if (res.ok && body.resolved && body.accountName) {
          setResolvedAccountName(body.accountName);
          setIsResolved(true);
          setResolveError(null);
          // If bank name was missing or generic, update it with provider's matched name
          if (body.bankName && !selectedBankName) {
            setSelectedBankName(body.bankName);
          }
        } else {
          setIsResolved(false);
          setResolvedAccountName(null);
          setResolveError(
            body.error || "Could not resolve account name. Check the account number and bank."
          );
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setIsResolved(false);
        setResolvedAccountName(null);
        setResolveError("Network error checking account details. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsResolving(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [accountNumber, selectedBankCode, isResolved, resolvedAccountName, selectedBankName]);

  // Handle bank selection
  const handleSelectBank = (bank: PaystackBankOption) => {
    setSelectedBankCode(bank.code);
    setSelectedBankName(bank.name);
    setIsBankDropdownOpen(false);
    setBankSearchQuery("");

    // Immediately clear previous resolution to prevent stale name mismatch
    setResolvedAccountName(null);
    setIsResolved(false);
    setResolveError(null);
    setIsConfirmed(false);
  };

  // Handle account number change
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(cleaned);

    // Immediately clear previous resolution when number changes
    setResolvedAccountName(null);
    setIsResolved(false);
    setResolveError(null);
    setIsConfirmed(false);
  };

  // Filtered banks for search
  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── 1. Bank Selector ── */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-xs font-semibold text-[#111827] mb-1.5 flex items-center justify-between">
          <span>
            Select Nigerian Bank <span className="text-[#065F46]">*</span>
          </span>
          {loadingBanks && (
            <span className="text-[11px] text-[#6B7280] flex items-center gap-1 font-normal">
              <Loader2 size={12} className="animate-spin text-[#065F46]" />
              Loading banks...
            </span>
          )}
        </label>

        {/* Dropdown Trigger */}
        <button
          type="button"
          disabled={disabled || loadingBanks}
          onClick={() => {
            setIsBankDropdownOpen((prev) => !prev);
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
          className={`w-full h-11 px-3.5 pr-10 rounded-lg border text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
            disabled ? "bg-stone-100 text-stone-400 cursor-not-allowed" : "bg-white hover:border-[#9CA3AF]"
          } ${
            isBankDropdownOpen
              ? "border-[#065F46] ring-2 ring-[#065F46]/15"
              : "border-[#D1D5DB] text-[#111827]"
          }`}
        >
          <span className="truncate">
            {selectedBankName ? selectedBankName : "Search & select bank..."}
          </span>
          <ChevronDown
            size={16}
            className={`text-[#6B7280] shrink-0 transition-transform ${
              isBankDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Searchable Dropdown Menu */}
        {isBankDropdownOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-[#D1D5DB] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-72 flex flex-col">
            {/* Search Input */}
            <div className="p-2 border-b border-[#E5E7EB] bg-stone-50/70 flex items-center gap-2">
              <Search size={15} className="text-[#6B7280] shrink-0 ml-1.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={bankSearchQuery}
                onChange={(e) => setBankSearchQuery(e.target.value)}
                placeholder="Type bank name (e.g. GTBank, Access, Zenith, Kuda)..."
                className="w-full h-8 px-2 bg-transparent text-xs text-[#111827] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>

            {/* Banks List */}
            <div className="overflow-y-auto flex-1 divide-y divide-[#F3F4F6] text-xs">
              {filteredBanks.length === 0 ? (
                <div className="p-4 text-center text-[#6B7280]">
                  No matching banks found for &ldquo;{bankSearchQuery}&rdquo;
                </div>
              ) : (
                filteredBanks.map((bank) => {
                  const isSelected = bank.code === selectedBankCode;
                  return (
                    <button
                      key={bank.code}
                      type="button"
                      onClick={() => handleSelectBank(bank)}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-emerald-50/70 transition-colors cursor-pointer ${
                        isSelected ? "bg-emerald-50 text-[#065F46] font-semibold" : "text-[#1F2937]"
                      }`}
                    >
                      <span className="truncate">{bank.name}</span>
                      {isSelected && <CheckCircle2 size={14} className="text-[#065F46] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {bankLoadError && (
          <div className="mt-1 flex items-center justify-between text-xs text-rose-600">
            <span>{bankLoadError}</span>
            <button
              type="button"
              onClick={fetchBanks}
              className="text-emerald-700 underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
      </div>

      {/* ── 2. Account Number Input ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="nubanAccount" className="text-xs font-semibold text-[#111827]">
            10-Digit NUBAN Account Number <span className="text-[#065F46]">*</span>
          </label>
          <span
            className={`text-[11px] font-mono ${
              accountNumber.length === 10 ? "text-[#065F46] font-bold" : "text-[#9CA3AF]"
            }`}
          >
            {accountNumber.length}/10 digits
          </span>
        </div>

        <div className="relative">
          <input
            id="nubanAccount"
            type="text"
            inputMode="numeric"
            maxLength={10}
            disabled={disabled}
            value={accountNumber}
            onChange={handleAccountChange}
            onBlur={() => setTouchedAccount(true)}
            placeholder="e.g. 0123456789"
            className={`w-full h-11 px-3.5 pr-10 rounded-lg border text-sm font-mono tracking-wider outline-none transition-colors duration-150 ${
              disabled
                ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                : isResolved
                ? "border-emerald-500 bg-white text-[#111827] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15"
                : resolveError && touchedAccount
                ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 bg-white"
            }`}
          />

          {/* Inline Feedback Icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {isResolving && <Loader2 size={16} className="animate-spin text-[#065F46]" />}
            {!isResolving && isResolved && (
              <div className="w-5 h-5 rounded-full bg-[#065F46] text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 size={13} strokeWidth={2.5} />
              </div>
            )}
            {!isResolving && resolveError && (
              <AlertCircle size={16} className="text-rose-500" />
            )}
          </div>
        </div>

        {/* NUBAN Status / Error Messages */}
        {isResolving && (
          <p className="mt-1.5 text-xs text-[#065F46] flex items-center gap-1.5 font-medium animate-in fade-in">
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span>Resolving account name via Paystack NUBAN inquiry...</span>
          </p>
        )}

        {!isResolving && resolveError && (
          <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle size={13} className="shrink-0" />
            <span>{resolveError}</span>
          </p>
        )}

        {!isResolving && !resolveError && !isResolved && accountNumber.length > 0 && accountNumber.length < 10 && (
          <p className="mt-1 text-[11px] text-[#6B7280]">
            Enter {10 - accountNumber.length} more digit{10 - accountNumber.length > 1 ? "s" : ""} to resolve account.
          </p>
        )}
      </div>

      {/* ── 3. Verified Account Holder Name (Official Paystack Match) ── */}
      <div>
        <label className="block text-xs font-semibold text-[#111827] mb-1.5 flex items-center justify-between">
          <span>
            Account Holder Name <span className="text-[#065F46]">*</span>
          </span>
          {isResolved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#065F46] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck size={12} /> Verified by Paystack
            </span>
          )}
        </label>

        <div className="relative">
          <input
            type="text"
            readOnly
            disabled
            value={resolvedAccountName || ""}
            placeholder={
              isResolving
                ? "Connecting to banking network..."
                : isResolved
                ? resolvedAccountName || ""
                : "Auto-verified when bank and 10 digits are entered"
            }
            className={`w-full h-11 px-3.5 pr-10 rounded-lg border text-sm font-medium transition-colors ${
              isResolved
                ? "border-[#065F46] bg-[#F0FDF9] text-[#065F46] font-semibold"
                : "border-[#E5E7EB] bg-stone-50 text-[#6B7280] cursor-not-allowed"
            }`}
          />
          <Lock size={14} className="text-[#9CA3AF] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ── 4. Confirmation Step (Banking App Style) ── */}
      {showConfirmationStep && isResolved && resolvedAccountName && (
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-[#065F46] uppercase tracking-wider">
            <Landmark size={15} />
            <span>Confirm Settlement Destination</span>
          </div>

          <div className="space-y-1 text-xs text-[#1F2937]">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Bank:</span>
              <span className="font-semibold text-[#111827]">{selectedBankName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Account Number:</span>
              <span className="font-mono font-bold text-[#111827]">{maskAccountNumber(accountNumber)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Beneficiary Name:</span>
              <span className="font-bold text-[#065F46]">{resolvedAccountName}</span>
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-2 border-t border-emerald-200/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-emerald-400 text-[#065F46] focus:ring-[#065F46]"
            />
            <span className="text-xs text-[#374151] leading-relaxed">
              I confirm that this Nigerian bank account belongs to me and will accurately receive rental payouts.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
