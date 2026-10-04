"use client";

import { useState } from "react";
import { Send } from "lucide-react";

type ChatInputProps = {
  disabled: boolean;
  onSend: (text: string) => void;
};

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="sticky bottom-0 border-t border-border bg-background/95 py-4 backdrop-blur">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Ask about ingredients, labels, or what you scanned…"
          aria-label="Message"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          data-testid="chat-input"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          aria-label="Send message"
          data-testid="chat-send"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        FoodGuard AI gives preliminary information and never replaces official inspection or advice.
      </p>
    </div>
  );
}