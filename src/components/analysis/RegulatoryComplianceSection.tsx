"use client";

import { useState } from "react";
import {
  Shield,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Info,
  Beaker,
  Tag,
  FileText,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FssaiRegulatoryStatus,
  RegulatoryCheckResult,
  RegulatoryCompliance,
} from "@/types/domain";

// ── User-facing status styling ────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }
> = {
  PASS: {
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-900/50",
    label: "Compliant",
  },
  EXCEEDS_LIMIT: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-900/50",
    label: "Exceeds Limit",
  },
  BELOW_MINIMUM: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-900/50",
    label: "Below Minimum",
  },
  UNIT_MISMATCH: {
    icon: AlertCircle,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-900/50",
    label: "Unit Mismatch",
  },
  REVIEW_REQUIRED: {
    icon: HelpCircle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900/50",
    label: "Review Required",
  },
  CATEGORY_REQUIRED: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900/50",
    label: "Category Required",
  },
  NO_APPLICABLE_LIMIT: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900/50",
    label: "No Applicable Limit",
  },
  LIMIT_LOOKUP: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900/50",
    label: "Limit Available",
  },
  NO_APPLICABLE_RULE: {
    icon: Info,
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/40",
    border: "border-gray-200 dark:border-gray-800",
    label: "No Applicable Rule",
  },
  NON_NUMERIC_LIMIT: {
    icon: Info,
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/40",
    border: "border-gray-200 dark:border-gray-800",
    label: "Non-numeric Limit",
  },
  INACTIVE_RULE: {
    icon: Info,
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/40",
    border: "border-gray-200 dark:border-gray-800",
    label: "Inactive Rule",
  },
  SERVICE_UNAVAILABLE: {
    icon: AlertCircle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900/50",
    label: "Service Unavailable",
  },
};

const DEFAULT_STATUS: keyof typeof STATUS_CONFIG = "REVIEW_REQUIRED";

function statusConfig(status: FssaiRegulatoryStatus | undefined | null) {
  return STATUS_CONFIG[status ?? ""] ?? STATUS_CONFIG[DEFAULT_STATUS];
}

// ── Evidence / source disclosure ─────────────────────────────────

function EvidenceList({ result }: { result: RegulatoryCheckResult }) {
  const [open, setOpen] = useState(false);
  const ruleId = result.ruleId;
  const regulation = result.regulation;
  if (!ruleId && !regulation) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="size-3" aria-hidden="true" />
        Source rule
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs space-y-1">
          {ruleId && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Rule:</span>
              <code className="text-foreground">{ruleId}</code>
            </div>
          )}
          {regulation && (
            <div className="text-muted-foreground">Regulation: <span className="text-foreground">{regulation}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Per-substance card ───────────────────────────────────────────

function CheckCard({ result }: { result: RegulatoryCheckResult }) {
  const [open, setOpen] = useState(false);
  const cfg = statusConfig(result.status) as { icon: typeof CheckCircle2; color: string; label: string };
  const Icon = cfg.icon;

  const amountLabel =
    result.detectedAmount != null
      ? `${result.detectedAmount} ${result.detectedUnit ?? ""}`.trim()
      : null;
  const allowedLabel =
    result.allowedAmount != null
      ? `${result.allowedAmount} ${result.allowedUnit ?? ""}`.trim()
      : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("size-4 shrink-0", cfg.color)} aria-hidden="true" />
          <span className="text-sm font-medium text-foreground truncate">{result.name}</span>
          {result.type === "additive" ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Additive
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contaminant
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 text-sm space-y-2">
          {result.message && <p className="text-xs text-muted-foreground">{result.message}</p>}
          {result.foodCategory && (
            <div><span className="text-muted-foreground">Food category: </span><span className="text-foreground">{result.foodCategory}</span></div>
          )}
          {amountLabel && (
            <div><span className="text-muted-foreground">Detected: </span><span className="text-foreground">{amountLabel}</span></div>
          )}
          {allowedLabel && (
            <div><span className="text-muted-foreground">Maximum limit: </span><span className="text-foreground">{allowedLabel}</span></div>
          )}
          {result.evidenceAvailable && <EvidenceList result={result} />}
        </div>
      )}
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────

type RegulatoryComplianceSectionProps = {
  title: string;
  compliance: RegulatoryCompliance;
};

export function RegulatoryComplianceSection({ title, compliance }: RegulatoryComplianceSectionProps) {
  const [showAdditives, setShowAdditives] = useState(true);
  const [showContaminants, setShowContaminants] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  if (!compliance) return null;

  const overallCfg = statusConfig(compliance.overallStatus) as {
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
    border: string;
    label: string;
  };
  const OverallIcon = overallCfg.icon;
  const additiveCount = compliance.additives?.length ?? 0;
  const contaminantCount = compliance.contaminants?.length ?? 0;
  const violationCount = compliance.violations?.length ?? 0;
  const evidenceCount = compliance.evidence?.length ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-primary" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>

      {/* Status banner */}
      <div className={cn("flex items-start gap-3 rounded-xl border p-4", overallCfg.bg, overallCfg.border)}>
        <OverallIcon className={cn("size-5 shrink-0 mt-0.5", overallCfg.color)} aria-hidden="true" />
        <div className="min-w-0">
          <div className={cn("text-sm font-semibold", overallCfg.color)}>{overallCfg.label}</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {!compliance.serviceAvailable
              ? "The FSSAI regulatory service could not be reached. Regulatory compliance could not be verified and should not be treated as a pass."
              : compliance.message || "Regulatory compliance is reported separately from the health score and is based on the FSSAI regulatory database."}
          </p>
        </div>
      </div>

      {/* Violations */}
      {violationCount > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {violationCount} violation{violationCount === 1 ? "" : "s"} detected
          </div>
          <ul className="mt-2 space-y-1 text-xs text-red-700 dark:text-red-400">
            {compliance.violations.map((v, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{v.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Tag className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Additives:</span>
          <span className="text-foreground font-medium">{additiveCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Beaker className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Contaminants:</span>
          <span className="text-foreground font-medium">{contaminantCount}</span>
        </div>
      </div>

      {/* Additives */}
      {additiveCount > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowAdditives(!showAdditives)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Additives ({additiveCount})</span>
            </div>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showAdditives && "rotate-180")} />
          </button>
          {showAdditives && (
            <div className="mt-2 space-y-2">
              {compliance.additives.map((a, i) => (
                <CheckCard key={i} result={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contaminants */}
      {contaminantCount > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowContaminants(!showContaminants)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Beaker className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Contaminants ({contaminantCount})</span>
            </div>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showContaminants && "rotate-180")} />
          </button>
          {showContaminants && (
            <div className="mt-2 space-y-2">
              {compliance.contaminants.map((c, i) => (
                <CheckCard key={i} result={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Source rules */}
      {evidenceCount > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Source rules ({evidenceCount})</span>
            </div>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showEvidence && "rotate-180")} />
          </button>
          {showEvidence && (
            <div className="mt-2 space-y-1">
              {compliance.evidence.map((e, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <code className="text-foreground">{e.ruleId}</code>
                  {e.regulation && <span className="text-muted-foreground">{e.regulation}</span>}
                  {e.sourceText && <span className="text-muted-foreground truncate">“{e.sourceText}”</span>}
                  {e.sourceUrl && (
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      Source <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
        Regulatory status is informational, based on FSSAI limits matched to the scanned product data, and is reported
        separately from the health score. It does not constitute a formal compliance certification.
      </p>
    </div>
  );
}
