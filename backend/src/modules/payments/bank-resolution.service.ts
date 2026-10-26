import { env } from "../../config/env";
import { getDb, schema } from "../../db/client";
import { eq } from "drizzle-orm";
import { PaystackTransferService } from "./paystack-transfer.service";

export interface PaystackBank {
  name: string;
  code: string;
  slug: string;
  type?: string;
}

export interface AccountResolutionResult {
  resolved: boolean;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  error?: string;
}

// Fallback list of major Nigerian commercial banks & fintechs with official CBN NIP codes
export const FALLBACK_NIGERIAN_BANKS: PaystackBank[] = [
  { name: "Access Bank", code: "044", slug: "access-bank", type: "nuban" },
  { name: "Access Bank (Diamond)", code: "063", slug: "access-bank-diamond", type: "nuban" },
  { name: "Citibank Nigeria", code: "023", slug: "citibank-nigeria", type: "nuban" },
  { name: "Ecobank Nigeria", code: "050", slug: "ecobank-nigeria", type: "nuban" },
  { name: "Fidelity Bank", code: "070", slug: "fidelity-bank", type: "nuban" },
  { name: "First Bank of Nigeria", code: "011", slug: "first-bank-of-nigeria", type: "nuban" },
  { name: "First City Monument Bank (FCMB)", code: "214", slug: "first-city-monument-bank", type: "nuban" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058", slug: "guaranty-trust-bank", type: "nuban" },
  { name: "Heritage Bank", code: "030", slug: "heritage-bank", type: "nuban" },
  { name: "Jaiz Bank", code: "301", slug: "jaiz-bank", type: "nuban" },
  { name: "Keystone Bank", code: "082", slug: "keystone-bank", type: "nuban" },
  { name: "Kuda Bank", code: "50211", slug: "kuda-bank", type: "nuban" },
  { name: "Moniepoint Microfinance Bank", code: "50515", slug: "moniepoint-mfb-ng", type: "nuban" },
  { name: "OPay Digital Services (Paycom)", code: "999992", slug: "paycom", type: "nuban" },
  { name: "PalmPay", code: "999991", slug: "palmpay", type: "nuban" },
  { name: "Polaris Bank", code: "076", slug: "polaris-bank", type: "nuban" },
  { name: "Providus Bank", code: "101", slug: "providus-bank", type: "nuban" },
  { name: "Stanbic IBTC Bank", code: "221", slug: "stanbic-ibtc-bank", type: "nuban" },
  { name: "Standard Chartered Bank", code: "068", slug: "standard-chartered-bank", type: "nuban" },
  { name: "Sterling Bank", code: "232", slug: "sterling-bank", type: "nuban" },
  { name: "SunTrust Bank", code: "100", slug: "suntrust-bank", type: "nuban" },
  { name: "TAJ Bank", code: "302", slug: "taj-bank", type: "nuban" },
  { name: "Titan Trust Bank", code: "102", slug: "titan-trust-bank", type: "nuban" },
  { name: "Union Bank of Nigeria", code: "032", slug: "union-bank-of-nigeria", type: "nuban" },
  { name: "United Bank for Africa (UBA)", code: "033", slug: "united-bank-for-africa", type: "nuban" },
  { name: "Unity Bank", code: "215", slug: "unity-bank", type: "nuban" },
  { name: "VFD Microfinance Bank", code: "566", slug: "vfd", type: "nuban" },
  { name: "Wema Bank / ALAT", code: "035", slug: "wema-bank", type: "nuban" },
  { name: "Zenith Bank", code: "057", slug: "zenith-bank", type: "nuban" },
];

/**
 * In-memory cache for bank list to avoid spamming Paystack API on every keystroke/page load.
 * TTL: 24 hours.
 */
let cachedBanks: PaystackBank[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Rate limiter: max 25 resolutions per minute per client IP.
 */
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_MAX = 25;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ipOrKey: string): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(ipOrKey);
  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(ipOrKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return false;
  }
  bucket.count++;
  return true;
}

/**
 * Helper to mask an account number, showing only the last 4 digits.
 * e.g. "0123456789" -> "•••• •••• 6789"
 */
export function maskAccountNumber(acc: string | null | undefined): string {
  if (!acc) return "—";
  const cleaned = acc.trim();
  if (cleaned.length < 4) return "••••";
  return `•••• •••• ${cleaned.slice(-4)}`;
}

export class BankResolutionService {
  /**
   * Fetch official Nigerian bank list from Paystack or serve cached data.
   */
  static async getNigerianBanks(forceRefresh = false): Promise<PaystackBank[]> {
    const now = Date.now();
    if (!forceRefresh && cachedBanks && now < cacheExpiresAt) {
      return cachedBanks;
    }

    if (!env.PAYSTACK_SECRET_KEY) {
      console.warn("[BankResolution] PAYSTACK_SECRET_KEY not set. Using curated Nigerian bank list.");
      cachedBanks = [...FALLBACK_NIGERIAN_BANKS].sort((a, b) => a.name.localeCompare(b.name));
      cacheExpiresAt = now + CACHE_TTL_MS;
      return cachedBanks;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=250", {
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const body = await res.json();
      if (!res.ok || !body.status || !Array.isArray(body.data)) {
        console.warn(`[BankResolution] Paystack bank list returned non-ok status: ${res.status}. Using fallback.`);
        if (cachedBanks) return cachedBanks;
        return [...FALLBACK_NIGERIAN_BANKS].sort((a, b) => a.name.localeCompare(b.name));
      }

      const banks: PaystackBank[] = body.data
        .filter((b: any) => b.is_deleted !== true && b.active !== false && b.code)
        .map((b: any) => ({
          name: b.name.trim(),
          code: String(b.code).trim(),
          slug: b.slug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          type: b.type || "nuban",
        }))
        .sort((a: PaystackBank, b: PaystackBank) => a.name.localeCompare(b.name));

      cachedBanks = banks;
      cacheExpiresAt = now + CACHE_TTL_MS;
      return banks;
    } catch (err: any) {
      console.warn(`[BankResolution] Failed to fetch banks from Paystack (${err.message}). Using fallback list.`);
      if (cachedBanks) return cachedBanks;
      return [...FALLBACK_NIGERIAN_BANKS].sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  /**
   * Real-time NUBAN Account Name Inquiry via official Paystack API:
   * GET https://api.paystack.co/bank/resolve?account_number={ACC}&bank_code={CODE}
   */
  static async resolveBankAccount(
    accountNumber: string,
    bankCode: string,
    clientIp = "default"
  ): Promise<AccountResolutionResult> {
    // 1. Validate inputs
    const cleanedAccount = String(accountNumber || "").replace(/\D/g, "").trim();
    const cleanedCode = String(bankCode || "").trim();

    if (!cleanedAccount || cleanedAccount.length !== 10) {
      return {
        resolved: false,
        error: "Nigerian NUBAN account numbers must be exactly 10 digits.",
      };
    }

    if (!cleanedCode) {
      return {
        resolved: false,
        error: "Bank code is required to resolve account details.",
      };
    }

    // 2. Check rate limit
    if (!checkRateLimit(clientIp)) {
      return {
        resolved: false,
        error: "Too many account lookup requests. Please wait a moment and try again.",
      };
    }

    // 3. Match bank code with official bank list
    const banks = await this.getNigerianBanks();
    const matchedBank = banks.find((b) => b.code === cleanedCode);
    const bankName = matchedBank ? matchedBank.name : undefined;

    if (!env.PAYSTACK_SECRET_KEY) {
      // In local dev without key, if account is 10 digits, simulate safe mock or inform
      if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
        return {
          resolved: true,
          accountName: "MOCK VERIFIED ACCOUNT",
          accountNumber: cleanedAccount,
          bankCode: cleanedCode,
          bankName: bankName || "Demo Bank Nigeria",
        };
      }
      return {
        resolved: false,
        error: "Paystack API key not configured on server.",
      };
    }

    // 4. Secure Paystack NUBAN Inquiry
    const maskedLog = maskAccountNumber(cleanedAccount);
    console.info(`[BankResolution] Resolving account ${maskedLog} with bank code ${cleanedCode}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
        cleanedAccount
      )}&bank_code=${encodeURIComponent(cleanedCode)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const body = await res.json();

      if (!res.ok || !body.status || !body.data || !body.data.account_name) {
        const errorMsg =
          body.message ||
          "Could not resolve account name with this bank. Please confirm the bank and account number.";
        return {
          resolved: false,
          error: errorMsg,
          accountNumber: cleanedAccount,
          bankCode: cleanedCode,
        };
      }

      const resolvedAccountName = String(body.data.account_name).trim().toUpperCase();

      return {
        resolved: true,
        accountName: resolvedAccountName,
        accountNumber: cleanedAccount,
        bankCode: cleanedCode,
        bankName: bankName || matchedBank?.name || "Verified Nigerian Bank",
      };
    } catch (err: any) {
      console.error(`[BankResolution] Provider error during resolution of ${maskedLog}:`, err.message);
      return {
        resolved: false,
        error: "Network timeout communicating with Nigerian banking switch. Please try again.",
        accountNumber: cleanedAccount,
        bankCode: cleanedCode,
      };
    }
  }

  /**
   * Securely update a host's payout bank account after mandatory server-side Paystack verification.
   * Records audit history and updates verification timestamp.
   */
  static async updateHostPayoutAccount(
    hostUserId: string,
    params: {
      bankCode: string;
      accountNumber: string;
    },
    clientIp = "default",
    adminActorId?: string
  ): Promise<{
    success: boolean;
    message: string;
    account: {
      bankName: string;
      bankCode: string;
      accountNumberMasked: string;
      accountName: string;
      verifiedAt: Date;
    };
  }> {
    const db = getDb();

    // 1. Verify host profile exists
    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, hostUserId))
      .limit(1);

    if (!profile) {
      throw new Error("Host profile not found.");
    }

    // 2. Authoritatively resolve with Paystack on the backend
    const resolution = await this.resolveBankAccount(params.accountNumber, params.bankCode, clientIp);
    if (!resolution.resolved || !resolution.accountName) {
      throw new Error(
        resolution.error || "The bank account could not be verified by Paystack. Please check details."
      );
    }

    // 3. Register as Paystack Transfer Recipient for automated host payouts
    let paystackRecipientCode = profile.paystackRecipientCode || null;
    try {
      const recipientRes = await PaystackTransferService.createTransferRecipient({
        name: resolution.accountName,
        accountNumber: resolution.accountNumber!,
        bankCode: params.bankCode,
        description: `Host Payout - ${resolution.accountName || hostUserId}`,
      });
      if (recipientRes.success && recipientRes.recipientCode) {
        paystackRecipientCode = recipientRes.recipientCode;
      }
    } catch (recErr: any) {
      console.warn(`[BankResolution] Transfer recipient registration notice: ${recErr.message}`);
    }

    const previousBank = profile.bankName;
    const previousMasked = maskAccountNumber(profile.bankAccountNumber);
    const verifiedAt = new Date();

    // 4. Atomic database update
    await db
      .update(schema.profiles)
      .set({
        bankName: resolution.bankName || "Verified Bank",
        bankCode: params.bankCode,
        bankAccountNumber: resolution.accountNumber,
        bankAccountName: resolution.accountName,
        bankAccountVerifiedAt: verifiedAt,
        paystackRecipientCode,
        updatedAt: verifiedAt,
      })
      .where(eq(schema.profiles.userId, hostUserId));

    // 5. Record audit log
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminActorId || hostUserId,
      action: "UPDATE_PAYOUT_ACCOUNT",
      entityType: "HOST_PROFILE",
      entityId: hostUserId,
      details: JSON.stringify({
        previousBank: previousBank || null,
        previousAccount: previousMasked,
        newBank: resolution.bankName,
        newAccountMasked: maskAccountNumber(resolution.accountNumber),
        resolvedAccountName: resolution.accountName,
        paystackRecipientCode,
        verifiedAt: verifiedAt.toISOString(),
        actor: adminActorId ? `ADMIN:${adminActorId}` : `HOST:${hostUserId}`,
      }),
      ipAddress: clientIp !== "default" ? clientIp : null,
      createdAt: verifiedAt,
    });

    return {
      success: true,
      message: "Payout bank account verified and updated successfully.",
      account: {
        bankName: resolution.bankName || "Verified Bank",
        bankCode: params.bankCode,
        accountNumberMasked: maskAccountNumber(resolution.accountNumber),
        accountName: resolution.accountName,
        verifiedAt,
      },
    };
  }
}
