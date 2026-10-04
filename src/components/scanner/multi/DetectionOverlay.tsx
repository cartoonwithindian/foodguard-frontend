/**
 * Multi-Product Scanner — detection overlay (Phase 2).
 *
 * Renders one tappable bounding box per detection over an `object-contain`
 * image. Canonical coordinates stay normalized; this layer converts them to
 * screen positions via the actually-painted image rect (letterbox-aware),
 * re-measured with ResizeObserver so boxes track resizes, orientation
 * changes, and differing aspect ratios.
 *
 * Styling is deliberately NEUTRAL (amber annotation chrome): confidence is
 * detection confidence, never a health score — no green/red semantics.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { computeContainRect, toPercentBox } from "@/lib/multi-scan/geometry";
import type { ProductDetection } from "@/lib/multi-scan/types";
import { cn } from "@/lib/utils";

type DetectionOverlayProps = {
  naturalWidth: number;
  naturalHeight: number;
  detections: ProductDetection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function DetectionOverlay({
  naturalWidth,
  naturalHeight,
  detections,
  selectedId,
  onSelect,
}: DetectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Track the container (== the <img> box) across resizes / rotations.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!containerSize || detections.length === 0) {
    return <div ref={containerRef} className="pointer-events-none absolute inset-0" />;
  }

  const painted = computeContainRect(
    naturalWidth,
    naturalHeight,
    containerSize.width,
    containerSize.height,
  );
  if (painted.width === 0 || painted.height === 0) {
    return <div ref={containerRef} className="pointer-events-none absolute inset-0" />;
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* Inner layer aligned exactly to the painted image (letterbox-aware). */}
      <div
        className="absolute"
        style={{
          left: painted.x,
          top: painted.y,
          width: painted.width,
          height: painted.height,
        }}
      >
        {detections.map((detection, index) => {
          const box = toPercentBox(detection.boundingBox);
          const selected = detection.id === selectedId;
          return (
            <button
              key={detection.id}
              type="button"
              onClick={() => onSelect(detection.id)}
              aria-pressed={selected}
              aria-label={`Detected product ${index + 1}, detection confidence ${Math.round(detection.confidence * 100)} percent`}
              className={cn(
                "group absolute rounded-md border-2 transition-all",
                selected
                  ? "z-10 border-amber-300 bg-amber-300/10 shadow-[0_0_0_3px_rgba(252,211,77,0.35)]"
                  : "border-amber-400/90 bg-amber-400/5 hover:bg-amber-300/15",
              )}
              style={{
                left: `${box.leftPct}%`,
                top: `${box.topPct}%`,
                width: `${box.widthPct}%`,
                height: `${box.heightPct}%`,
              }}
            >
              <span
                className={cn(
                  "absolute -top-0.5 left-0 -translate-y-full whitespace-nowrap rounded-t-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-black sm:text-[11px]",
                  selected ? "bg-amber-300" : "bg-amber-400",
                )}
              >
                #{index + 1} · {Math.round(detection.confidence * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
