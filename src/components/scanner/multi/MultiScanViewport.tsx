/**
 * Multi-Product Scanner — dedicated scanning viewport (Phase 1).
 *
 * Wide, multi-product scanning region (NOT the single-product square
 * viewport): rounded corners, subtle border, corner brackets, and a gentle
 * animated scan line. Honest status copy only — no fake product labels.
 */
"use client";

import type { RefObject } from "react";
import { ScanLine, VideoOff } from "lucide-react";
import type { MultiScannerStatus } from "@/lib/multi-scan/types";
import { cn } from "@/lib/utils";

type MultiScanViewportProps = {
  status: MultiScannerStatus;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Live preview visible (camera streaming or captured frame shown). */
  showVideo: boolean;
};

function Corner({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("absolute h-9 w-9 border-primary/90 sm:h-12 sm:w-12", className)}
    />
  );
}

export function MultiScanViewport({ status, videoRef, showVideo }: MultiScanViewportProps) {
  const showOverlay =
    status === "PERMISSION_DENIED" ||
    status === "CAMERA_UNSUPPORTED" ||
    status === "CAMERA_ERROR";
  const isLive = status === "SCANNING" || status === "CAMERA_READY";

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-black shadow-sm aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9]">
      {showVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Requesting-permission shimmer */}
      {status === "CAMERA_REQUESTING_PERMISSION" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-white/70">Starting camera…</p>
          </div>
        </div>
      )}

      {/* Idle placeholder grid */}
      {status === "IDLE" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <ScanLine className="size-10 text-white/20" aria-hidden="true" />
        </div>
      )}

      {/* Error overlays (actions live in the parent, below the viewport). */}
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 text-center">
          <div className="flex max-w-xs flex-col items-center gap-2.5">
            <VideoOff
              className={cn(
                "size-10",
                status === "PERMISSION_DENIED" ? "text-destructive" : "text-white/40",
              )}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-white">
              {status === "PERMISSION_DENIED"
                ? "Camera Access Required"
                : status === "CAMERA_UNSUPPORTED"
                  ? "Camera unavailable"
                  : "Something went wrong"}
            </p>
            <p className="text-xs text-white/60">
              {status === "PERMISSION_DENIED"
                ? "Camera access is required to scan products."
                : status === "CAMERA_UNSUPPORTED"
                  ? "No camera is available on this device or connection."
                  : "Something went wrong while opening the camera."}
            </p>
          </div>
        </div>
      )}

      {/* Multi-product scanning region — wide, centered, bracketed. */}
      {!showOverlay && status !== "IDLE" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-8">
          <div className="relative h-full w-full max-w-2xl">
            <Corner className="left-0 top-0 rounded-tl-xl border-l-[3px] border-t-[3px]" />
            <Corner className="right-0 top-0 rounded-tr-xl border-r-[3px] border-t-[3px]" />
            <Corner className="bottom-0 left-0 rounded-bl-xl border-b-[3px] border-l-[3px]" />
            <Corner className="bottom-0 right-0 rounded-br-xl border-b-[3px] border-r-[3px]" />
            {isLive && (
              <div className="absolute inset-x-6 top-0 h-0.5 animate-scan-line bg-gradient-to-r from-transparent via-primary to-transparent sm:inset-x-10" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
