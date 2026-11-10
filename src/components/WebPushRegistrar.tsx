"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  enableWebPushAfterUserAction,
  syncWebPushIfAlreadyGranted,
  type WebPushSyncResult,
} from "@/lib/web-push-client";

/**
 * Silent sync when already granted + optional enable control.
 * Never prompts on cold start. Skips cleanly when VAPID is unset.
 */
export default function WebPushRegistrar() {
  const { isAuthenticated, isLoading } = useAuth();
  const [result, setResult] = useState<WebPushSyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || syncedRef.current) return;
    syncedRef.current = true;
    void syncWebPushIfAlreadyGranted().then(setResult);
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      syncedRef.current = false;
      setResult(null);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated || isLoading) return null;

  const showEnable =
    result?.status === "skipped" &&
    (result.reason === "permission-default" ||
      result.reason === "permission-denied");

  const unconfigured =
    result?.status === "skipped" && result.reason === "unconfigured";

  if (unconfigured || result?.status === "registered") return null;

  if (!showEnable && result?.status !== "error") return null;

  const handleEnable = async () => {
    setBusy(true);
    const next = await enableWebPushAfterUserAction();
    setResult(next);
    setBusy(false);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-40 max-w-sm rounded-lg border border-[#D8E2DC] bg-white px-4 py-3 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-[#24483A]">
        {result?.status === "error"
          ? "Browser alerts could not be enabled right now."
          : "Enable browser alerts for booking updates?"}
      </p>
      {showEnable ? (
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="mt-2 min-h-[44px] rounded-md bg-[#24483A] px-3 text-sm font-medium text-white disabled:opacity-60"
          aria-label="Enable browser push notifications"
        >
          {busy ? "Enabling…" : "Enable alerts"}
        </button>
      ) : null}
    </div>
  );
}
