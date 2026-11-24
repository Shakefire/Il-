import { env } from "../../config/env";
import { canUsePaystackDevMocks, isPaystackMockTransfersEnabled } from "../../lib/payment-mocks";

export interface PaystackRefundRequest {
  transactionReference: string;
  amountNaira: number;
  currency: string;
  idempotencyKey: string;
  customerNote: string;
  merchantNote: string;
}

export interface PaystackRefundOutcome {
  /** True only when the provider result itself is a terminal verified state. */
  verified: boolean;
  status: "success" | "failed" | "pending" | "reversed" | "unknown";
  providerReference?: string;
}

/**
 * Refund call. Tests and non-production mocks never hit api.paystack.co.
 * HTTP acceptance is not success: only a verified processed/success status is.
 */
export async function executePaystackRefund(
  params: PaystackRefundRequest
): Promise<PaystackRefundOutcome> {
  if (params.amountNaira <= 0 || params.currency !== "NGN") {
    return { verified: true, status: "failed" };
  }

  if (isPaystackMockTransfersEnabled() || canUsePaystackDevMocks()) {
    const forced = (process.env.PAYSTACK_REFUND_MOCK_RESULT || "success").toLowerCase();
    const providerReference = `mock_refund_${params.idempotencyKey}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80);
    if (forced === "failed") return { verified: true, status: "failed", providerReference };
    if (forced === "reversed") return { verified: true, status: "reversed", providerReference };
    if (forced === "pending") return { verified: true, status: "pending", providerReference };
    if (forced === "timeout" || forced === "unknown") return { verified: false, status: "unknown" };
    return { verified: true, status: "success", providerReference };
  }

  if (!env.PAYSTACK_SECRET_KEY) {
    return { verified: false, status: "unknown" };
  }

  const response = await fetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction: params.transactionReference,
      amount: params.amountNaira * 100,
      currency: "NGN",
      customer_note: params.customerNote,
      merchant_note: params.merchantNote,
    }),
  });

  const body = await response.json().catch(() => ({} as any));
  const providerReference = body?.data?.id != null ? String(body.data.id) : undefined;
  const providerStatus = String(body?.data?.status || "").toLowerCase();

  if (!response.ok || body?.status !== true) {
    return { verified: true, status: "failed", providerReference };
  }
  if (providerStatus === "processed" || providerStatus === "success") {
    return { verified: true, status: "success", providerReference };
  }
  if (providerStatus === "pending" || providerStatus === "processing") {
    return { verified: true, status: "pending", providerReference };
  }
  if (providerStatus === "failed") {
    return { verified: true, status: "failed", providerReference };
  }
  if (providerStatus === "reversed") {
    return { verified: true, status: "reversed", providerReference };
  }
  return { verified: false, status: "unknown", providerReference };
}
