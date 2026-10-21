"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  ListChecks,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { IssueType, ProductSnapshot } from "@/types/food-safety-assistant";
import { useAssistant } from "./use-assistant";
import { IssueSelector } from "./IssueSelector";
import { EvidenceChecklist } from "./EvidenceChecklist";
import { ComplaintReview } from "./ComplaintReview";
import { RegulatoryContext } from "./RegulatoryContext";
import { QUICK_ISSUE_OPTIONS } from "./state";

export type FoodSafetyAssistantProps = {
  product: ProductSnapshot | null;
  backHref: string;
  // Optional overrides for display labels — useful if the project adds
  // translations later. Defaults are intentional English.
  title?: string;
  subtitle?: string;
  helpLabel?: string;
  informationalUrl?: string;
};

export function FoodSafetyAssistant({
  product,
  backHref,
  title = "Food Safety Assistant",
  subtitle = "Get help understanding and reporting a food-safety concern.",
  helpLabel = "How does this work?",
  informationalUrl,
}: FoodSafetyAssistantProps) {
  const assistant = useAssistant({ product });
  const [draftText, setDraftText] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");
  const autoStarted = useRef(false);

  // Auto-start the conversation once on mount so users land in the
  // greeting, not an empty page.
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void assistant.start();
    // Start once with the initial product context; subsequent assistant
    // state changes must not restart the conversation.
    
  }, []);

  // Keep the editable text in sync when the server returns a new draft.
  const lastServerDraft = useRef<string | null>(null);
  useEffect(() => {
    const next = assistant.state.draft ? draftToText(assistant.state.draft) : null;
    if (next !== lastServerDraft.current) {
      lastServerDraft.current = next;
      setDraftText(next);
    }
  }, [assistant.state.draft]);

  const onChooseIssue = (issue: IssueType) => {
    void assistant.sendMessage({
      answerKey: "issue_type",
      answerValue: issue,
    });
  };

  const onAnswerCurrent = (value: unknown) => {
    void assistant.sendMessage({
      answerKey: assistant.state.currentQuestion?.field ?? null,
      answerValue: value,
    });
  };

  const onGenerate = async () => {
    await assistant.generateDraft();
  };

  const onReset = async () => {
    if (typeof window !== "undefined" && !window.confirm("Start over? Your current answers will be cleared.")) {
      return;
    }
    await assistant.reset();
    setDraftText(null);
  };

  const onRegenerate = async () => {
    await assistant.generateDraft();
  };

  const onCopy = async () => {
    if (!draftText) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(draftText);
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = draftText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyState("ok");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  const onEditDraft = (text: string) => {
    setDraftText(text);
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-14 z-30 lg:top-0 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
          <h1 className="ml-4 text-sm font-semibold text-foreground">{title}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {/* Top context */}
        <section className="mb-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                {product?.name ? `Help with ${product.name}` : title}
              </h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
              {product?.barcode && (
                <p className="text-xs text-muted-foreground/80">
                  Barcode: <span className="font-mono">{product.barcode}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        <SafetyNotice />

        {assistant.error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="text-red-700/90 dark:text-red-300/90">{assistant.error}</p>
            </div>
          </div>
        )}

        {/* Stage-driven content */}
        <section className="space-y-6">
          {assistant.state.stage === "greeting" && <GreetingStage />}
          {assistant.state.stage === "selecting_issue" && (
            <SelectingIssueStage
              onChoose={onChooseIssue}
              options={QUICK_ISSUE_OPTIONS}
            />
          )}
          {assistant.state.stage === "collecting_info" && assistant.state.currentQuestion && (
            <QuestionStage
              question={assistant.state.currentQuestion}
              onAnswer={onAnswerCurrent}
              freeText={freeText}
              setFreeText={setFreeText}
            />
          )}
          {assistant.state.stage === "ready_to_generate" && (
            <ReadyStage
              onGenerate={onGenerate}
              onReset={onReset}
            />
          )}
          {assistant.state.stage === "reviewing_draft" && assistant.state.draft && (
            <ReviewStage
              draft={assistant.state.draft}
              draftText={draftText ?? draftToText(assistant.state.draft)}
              copyState={copyState}
              onCopy={onCopy}
              onEdit={onEditDraft}
              onRegenerate={onRegenerate}
              onReset={onReset}
              reportingUrlAvailable={assistant.meta?.reportingUrlAvailable ?? false}
              informationalUrl={informationalUrl}
            />
          )}
        </section>

        <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Info className="size-3.5" aria-hidden="true" />
            {helpLabel}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Start over
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components (kept here to keep the public API small) ─────

function SafetyNotice() {
  return (
    <section className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <div className="flex items-start gap-3 text-amber-700 dark:text-amber-200">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">FoodGuard does not file complaints or replace medical advice.</p>
          <p className="mt-1 text-amber-700/90 dark:text-amber-200/90">
            The assistant helps you draft a factual request for review. It does not declare legal violations,
            impersonate FSSAI or give medical advice. If you experienced a serious reaction, please contact a
            healthcare professional.
          </p>
        </div>
      </div>
    </section>
  );
}

function GreetingStage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <MessageSquare className="size-5 text-primary" aria-hidden="true" />
      <p className="mt-3 text-sm text-muted-foreground">Loading the assistant…</p>
    </div>
  );
}

function SelectingIssueStage({
  options,
  onChoose,
}: {
  options: Array<{ value: IssueType; label: string; description: string }>;
  onChoose: (issue: IssueType) => void;
}) {
  return (
    <IssueSelector options={options} onChoose={onChoose} />
  );
}

function QuestionStage({
  question,
  onAnswer,
  freeText,
  setFreeText,
}: {
  question: NonNullable<ReturnType<typeof useAssistant>["state"]["currentQuestion"]>;
  onAnswer: (v: unknown) => void;
  freeText: string;
  setFreeText: (s: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">{question.prompt}</h2>
          {question.helpText && <p className="mt-1 text-sm text-muted-foreground">{question.helpText}</p>}

          {question.type === "choice" && question.choices && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {question.choices.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => onAnswer(c.value)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-background p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="font-medium text-foreground">{c.label}</span>
                  {c.description && <span className="text-xs text-muted-foreground">{c.description}</span>}
                </button>
              ))}
            </div>
          )}

          {question.type === "multichoice" && question.choices && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {question.choices.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => onAnswer([c.value])}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-background p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="font-medium text-foreground">{c.label}</span>
                  {c.description && <span className="text-xs text-muted-foreground">{c.description}</span>}
                </button>
              ))}
            </div>
          )}

          {question.type === "yesno" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAnswer(true)}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/5"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => onAnswer(false)}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/5"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => onAnswer("not_sure")}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/5"
              >
                Not sure
              </button>
            </div>
          )}

          {(question.type === "text" || question.type === "date") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (freeText.trim()) onAnswer(freeText.trim());
              }}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <div className="relative flex-1">
                <input
                  type={question.type === "date" ? "text" : "text"}
                  inputMode={question.type === "date" ? "numeric" : undefined}
                  placeholder={question.type === "date" ? "YYYY-MM-DD or relative (yesterday)" : "Type your answer"}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
                />
                {question.type === "date" && (
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Send <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </form>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            <AlertTriangle className="mr-1 inline-block size-3.5" aria-hidden="true" />
            We will not ask for personal details like your phone number or address. Avoid them in your answer.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReadyStage({ onGenerate, onReset }: { onGenerate: () => void; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Ready to draft</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ve shared the important details. Click below to generate a factual complaint draft. The
        draft uses only what you&apos;ve described — missing fields will appear as <em>Not provided</em>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ListChecks className="size-4" aria-hidden="true" />
          Generate draft
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Start over
        </button>
      </div>
    </div>
  );
}

function ReviewStage({
  draft,
  draftText,
  copyState,
  onCopy,
  onEdit,
  onRegenerate,
  onReset,
  reportingUrlAvailable,
  informationalUrl,
}: {
  draft: NonNullable<ReturnType<typeof useAssistant>["state"]["draft"]>;
  draftText: string;
  copyState: "idle" | "ok" | "error";
  onCopy: () => void;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  onReset: () => void;
  reportingUrlAvailable: boolean;
  informationalUrl?: string;
}) {
  return (
    <div className="space-y-6">
      <ComplaintReview draft={draft} draftText={draftText} onEdit={onEdit} />
      <EvidenceChecklist requirements={draft.evidenceChecklist} />
      {draft.observations.regulatoryContext.length > 0 && (
        <RegulatoryContext lines={draft.observations.regulatoryContext} />
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Next steps</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the draft to match your situation. When you&apos;re happy with it, copy it to your clipboard
          and paste it into the appropriate channel.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            data-testid="assistant-copy"
          >
            {copyState === "ok" ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                Copied
              </>
            ) : copyState === "error" ? (
              <>
                <TriangleAlert className="size-4" aria-hidden="true" />
                Copy failed
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" />
                Copy draft
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            data-testid="assistant-regenerate"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Regenerate
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Start over
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm">
          <div className="flex items-start gap-3 text-blue-700 dark:text-blue-300">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="space-y-2">
              <p className="font-medium">Submitting the complaint</p>
              <p>
                FoodGuard does not automatically submit complaints to any authority. If you&apos;d like to
                file the draft with FSSAI or your local food-safety department, use the official channel
                below — FoodGuard is not responsible for the submission process.
              </p>
              {reportingUrlAvailable ? (
                <p className="text-xs text-muted-foreground">
                  The configured reporting URL is available in this deployment. You can copy the draft
                  and paste it into that channel yourself.
                </p>
              ) : informationalUrl ? (
                <a
                  href={informationalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                >
                  Visit the official FSSAI website for general guidance
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function draftToText(d: NonNullable<ReturnType<typeof useAssistant>["state"]["draft"]>): string {
  const lines: string[] = [];
  lines.push(`Subject: ${d.subjectLine}`);
  lines.push("");
  lines.push(d.greeting);
  lines.push("");
  lines.push("Product details:");
  lines.push(`- Product: ${d.productDetails.productName ?? "Not provided"}`);
  lines.push(`- Brand: ${d.productDetails.brand ?? "Not provided"}`);
  lines.push(`- Barcode: ${d.productDetails.barcode ?? "Not provided"}`);
  lines.push(`- Batch / lot: ${d.productDetails.batchOrLot ?? "Not provided"}`);
  lines.push(`- Manufacturing date: ${d.productDetails.manufacturingDate ?? "Not provided"}`);
  lines.push(`- Expiry / best-before: ${d.productDetails.expiryDate ?? "Not provided"}`);
  lines.push("");
  lines.push("Purchase details:");
  lines.push(`- Purchase date: ${d.purchaseDetails.purchaseDate ?? "Not provided"}`);
  lines.push(`- Purchase location: ${d.purchaseDetails.purchaseLocation ?? "Not provided"}`);
  lines.push(`- Receipt: ${d.purchaseDetails.purchaseReceipt ?? "Not provided"}`);
  lines.push("");
  lines.push("Issue summary:");
  lines.push(d.issueSummary);
  lines.push("");
  lines.push("User observations:");
  for (const line of d.observations.userObservations) lines.push(`- ${line}`);
  lines.push("");
  lines.push("FoodGuard observations (informational):");
  for (const line of d.observations.foodguardObservations) lines.push(`- ${line}`);
  lines.push("");
  lines.push("Regulatory context:");
  for (const line of d.observations.regulatoryContext) lines.push(`- ${line}`);
  lines.push("");
  lines.push("Evidence checklist:");
  for (const ev of d.evidenceChecklist) {
    lines.push(`- [${ev.status === "provided" ? "Provided" : ev.status === "not_applicable" ? "Not applicable" : "Not provided"}] ${ev.label}`);
  }
  lines.push("");
  lines.push("Request:");
  lines.push(d.request);
  lines.push("");
  lines.push(d.closing);
  lines.push("");
  lines.push("—");
  lines.push(d.disclaimer);
  return lines.join("\n");
}
