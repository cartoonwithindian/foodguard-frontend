"use client";

import Link from "next/link";
import { ArrowLeft, MessagesSquare, Plus } from "lucide-react";

type ChatHeaderProps = {
  onNewChat: () => void;
  productName?: string | null;
  brand?: string | null;
};

export function ChatHeader({ onNewChat, productName, brand }: ChatHeaderProps) {
  const context =
    productName || brand ? `${[brand, productName].filter(Boolean).join(" · ")}` : null;
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/scan"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Back to scan"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessagesSquare className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight">FoodGuard AI</h1>
          <p className="truncate text-xs text-muted-foreground">
            {context ? `${context} — Food Safety Assistant` : "Food Safety Assistant"}
          </p>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label="Start a new chat"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>
    </header>
  );
}