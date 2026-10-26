/**
 * Paystack Transfers & Beneficiaries Engine
 * Production integration with Paystack Transfers API (v1 / 2026).
 * Handles Transfer Recipient registration (POST /transferrecipient),
 * Automated Transfer Initiation (POST /transfer), Status Inquiries (GET /transfer/:code),
 * and Transfer Balance verification (GET /balance).
 */

import { env } from "../../config/env";
import crypto from "crypto";

export interface CreateRecipientParams {
  name: string;
  accountNumber: string;
  bankCode: string;
  description?: string;
}

export interface CreateRecipientResult {
  success: boolean;
  recipientCode?: string;
  recipientId?: number;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  error?: string;
}

export interface InitiateTransferParams {
  amountNaira: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}

export interface InitiateTransferResult {
  success: boolean;
  transferCode?: string;
  reference: string;
  status: "pending" | "success" | "failed" | "otp_required";
  amountNaira: number;
  error?: string;
  rawResponse?: any;
}

export interface VerifyTransferResult {
  success: boolean;
  reference: string;
  transferCode: string;
  status: "success" | "pending" | "failed" | "reversed" | "unknown";
  amountNaira: number;
  paidAt?: Date;
  failureReason?: string;
  rawResponse?: any;
}

export class PaystackTransferService {
  /**
   * Register a Nigerian NUBAN bank account as a Paystack Transfer Recipient.
   * Endpoint: POST https://api.paystack.co/transferrecipient
   */
  static async createTransferRecipient(
    params: CreateRecipientParams
  ): Promise<CreateRecipientResult> {
    const { name, accountNumber, bankCode, description } = params;

    const cleanedAcc = String(accountNumber || "").replace(/\D/g, "").trim();
    const cleanedCode = String(bankCode || "").trim();

    if (!cleanedAcc || cleanedAcc.length !== 10) {
      return { success: false, error: "Account number must be 10 digits." };
    }
    if (!cleanedCode) {
      return { success: false, error: "Bank code is required." };
    }
    if (!name || name.trim().length === 0) {
      return { success: false, error: "Account holder name is required." };
    }

    if (process.env.NODE_ENV === "test" || process.env.PAYSTACK_MOCK_TRANSFERS === "true" || !env.PAYSTACK_SECRET_KEY) {
      // Mock recipient in dev/test without key or in automated tests
      const mockCode = `RCP_${crypto.randomBytes(8).toString("hex")}`;
      return {
        success: true,
        recipientCode: mockCode,
        accountName: name.toUpperCase().trim(),
        accountNumber: cleanedAcc,
      };
    }

    try {
      const res = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: name.trim().toUpperCase(),
          account_number: cleanedAcc,
          bank_code: cleanedCode,
          currency: "NGN",
          description: description || "Ilé Host Payout Beneficiary",
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.status || !body.data?.recipient_code) {
        console.warn("[PaystackTransfer] Recipient creation rejected:", body.message);
        return {
          success: false,
          error: body.message || "Failed to create transfer recipient on Paystack.",
        };
      }

      return {
        success: true,
        recipientCode: body.data.recipient_code,
        recipientId: body.data.id,
        bankName: body.data.details?.bank_name,
        accountName: body.data.details?.account_name || name,
        accountNumber: cleanedAcc,
      };
    } catch (err: any) {
      console.error("[PaystackTransfer] Recipient API network error:", err.message);
      return {
        success: false,
        error: `Network error connecting to Paystack recipient endpoint: ${err.message}`,
      };
    }
  }

  /**
   * Initiate a single automated transfer from Paystack balance to host beneficiary.
   * Endpoint: POST https://api.paystack.co/transfer
   */
  static async initiateTransfer(
    params: InitiateTransferParams
  ): Promise<InitiateTransferResult> {
    const { amountNaira, recipientCode, reference, reason } = params;

    if (!amountNaira || amountNaira <= 0) {
      return {
        success: false,
        reference,
        status: "failed",
        amountNaira: 0,
        error: "Transfer amount must be greater than zero.",
      };
    }

    if (!recipientCode || !recipientCode.startsWith("RCP_")) {
      return {
        success: false,
        reference,
        status: "failed",
        amountNaira,
        error: `Invalid Paystack recipient code: ${recipientCode}. Recipient must be generated via /transferrecipient.`,
      };
    }

    const amountKobo = Math.round(amountNaira * 100);

    if (process.env.NODE_ENV === "test" || process.env.PAYSTACK_MOCK_TRANSFERS === "true" || !env.PAYSTACK_SECRET_KEY) {
      // Mock successful initiation in dev/test without key or during test runs
      const mockTransferCode = `TRF_${crypto.randomBytes(8).toString("hex")}`;
      return {
        success: true,
        transferCode: mockTransferCode,
        reference,
        status: "pending",
        amountNaira,
      };
    }

    try {
      const res = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: amountKobo,
          recipient: recipientCode,
          reference,
          reason: reason || "Ilé Verified Stay Host Payout",
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.status) {
        const errorMsg = body.message || "Failed to initiate transfer on Paystack.";
        console.error("[PaystackTransfer] Transfer initiation failed:", errorMsg);

        // Check if OTP is required on merchant dashboard
        if (errorMsg.toLowerCase().includes("otp")) {
          return {
            success: false,
            reference,
            transferCode: body.data?.transfer_code,
            status: "otp_required",
            amountNaira,
            error: "Paystack requires OTP authorization. To enable 100% automated payouts, disable OTP on transfers in your Paystack dashboard Preferences.",
            rawResponse: body,
          };
        }

        return {
          success: false,
          reference,
          status: "failed",
          amountNaira,
          error: errorMsg,
          rawResponse: body,
        };
      }

      const txData = body.data;
      const transferStatus =
        txData.status === "success"
          ? "success"
          : txData.status === "failed"
          ? "failed"
          : "pending";

      return {
        success: true,
        transferCode: txData.transfer_code,
        reference: txData.reference || reference,
        status: transferStatus,
        amountNaira,
        rawResponse: body,
      };
    } catch (err: any) {
      console.error("[PaystackTransfer] Transfer API error:", err.message);
      return {
        success: false,
        reference,
        status: "pending", // Ambiguous: timeout or network drop requires reconciliation inquiry, not re-try
        amountNaira,
        error: `Network failure connecting to Paystack transfer switch: ${err.message}`,
      };
    }
  }

  /**
   * Verify the status of an initiated transfer by internal reference.
   * Endpoint: GET https://api.paystack.co/transfer/verify/:reference
   */
  static async verifyTransferByReference(
    reference: string
  ): Promise<VerifyTransferResult> {
    if (!env.PAYSTACK_SECRET_KEY) {
      return {
        success: true,
        reference,
        transferCode: `MOCK_TRF_${reference}`,
        status: "success",
        amountNaira: 0,
      };
    }

    try {
      const res = await fetch(
        `https://api.paystack.co/transfer/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.status || !body.data) {
        return {
          success: false,
          reference,
          transferCode: "",
          status: "unknown",
          amountNaira: 0,
          failureReason: body.message || "Failed to verify transfer status with Paystack.",
        };
      }

      const d = body.data;
      const amountNaira = Math.round((d.amount || 0) / 100);
      let status: VerifyTransferResult["status"] = "pending";
      if (d.status === "success") status = "success";
      else if (d.status === "failed") status = "failed";
      else if (d.status === "reversed") status = "reversed";

      return {
        success: true,
        reference: d.reference || reference,
        transferCode: d.transfer_code || "",
        status,
        amountNaira,
        paidAt: d.paid_at ? new Date(d.paid_at) : undefined,
        failureReason: d.failures?.reason || undefined,
        rawResponse: body,
      };
    } catch (err: any) {
      return {
        success: false,
        reference,
        transferCode: "",
        status: "unknown",
        amountNaira: 0,
        failureReason: err.message,
      };
    }
  }

  /**
   * Check available Paystack merchant balance for transfers.
   * Endpoint: GET https://api.paystack.co/balance
   */
  static async checkTransferBalance(): Promise<{
    available: boolean;
    balanceNaira: number;
    currency: string;
    error?: string;
  }> {
    if (!env.PAYSTACK_SECRET_KEY) {
      return { available: true, balanceNaira: 10_000_000, currency: "NGN" };
    }

    try {
      const res = await fetch("https://api.paystack.co/balance", {
        headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.status || !Array.isArray(body.data)) {
        return {
          available: false,
          balanceNaira: 0,
          currency: "NGN",
          error: body.message || "Failed to fetch Paystack balance",
        };
      }

      const ngn = body.data.find((b: any) => b.currency === "NGN");
      const balanceNaira = ngn ? Math.round(ngn.balance / 100) : 0;

      return {
        available: true,
        balanceNaira,
        currency: "NGN",
      };
    } catch (err: any) {
      return {
        available: false,
        balanceNaira: 0,
        currency: "NGN",
        error: err.message,
      };
    }
  }
}
