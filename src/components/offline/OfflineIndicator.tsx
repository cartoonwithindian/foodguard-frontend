"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useNetworkQuality } from "@/lib/network/use-network";
import { getSyncQueue } from "@/lib/offline/sync-queue";

type OfflineIndicatorProps = {
  /** Optional text overrides for a different language. */
  offlineLabel?: string;
  slowLabel?: string;
  queueLabel?: string;
};

/**
 * Lightweight, non-intrusive network state pill. Renders nothing when the
 * connection is healthy. Shows a subtle "offline / slow / queued" hint
 * otherwise — never a blocking banner (spec §12).
 */
export function OfflineIndicator({
  offlineLabel = "You're offline — using saved data",
  slowLabel = "Slow connection",
  queueLabel = "{count} updates queued",
}: OfflineIndicatorProps) {
  const quality = useNetworkQuality();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const count = await getSyncQueue().pending();
      if (!cancelled) setPending(count);
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const offline = quality === "offline";
  const slow = quality === "slow";
  if (!offline && !slow && pending === 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        offline
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          : "bg-muted text-muted-foreground"
      }`}
      role="status"
    >
      <WifiOff className="size-3" aria-hidden="true" />
      <span>
        {pending > 0 ? queueLabel.replace("{count}", String(pending)) : offline ? offlineLabel : slowLabel}
      </span>
    </div>
  );
}