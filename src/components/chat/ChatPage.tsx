"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { QuickActions } from "./QuickActions";
import { EmptyState as ChatEmptyState, Typing as ChatTyping, ErrorBanner as ChatErrorBanner } from "./ChatStates";
import { sendChatMessage, fetchChatHistory, ChatClientError } from "@/lib/chat-client";
import { ChallengeCompleteDialog } from "@/components/challenges/ChallengeCompleteDialog";
import type { ChallengeCompletion } from "@/services/challenge.service";
import type { ChatAction, ChatSourceRef } from "@/types/chat";

export type ChatPageProps = {
  productId?: string | null;
  productName?: string | null;
  brand?: string | null;
  barcode?: string | null;
  initialConversationId?: string | null;
  lang?: string | null;
};

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: ChatSourceRef[];
  actions?: ChatAction[];
};

export function ChatPage({
  productId,
  productName,
  brand,
  barcode,
  initialConversationId,
}: ChatPageProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedChallenge, setCompletedChallenge] = useState<ChallengeCompletion | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const productContext = useMemo(
    () => (productId ? { productId } : barcode ? { barcode } : null),
    [productId, barcode],
  );

  useEffect(() => {
    if (messages.length > 0 && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, pending]);

  useEffect(() => {
    if (!initialConversationId || hydrated) return;
    let cancelled = false;
    fetchChatHistory(initialConversationId)
      .then((history) => {
        if (cancelled) return;
        setMessages(
          history.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this conversation. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialConversationId, hydrated]);

  const handleSend = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || pending) return;
      setError(null);
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() },
      ]);
      setPending(true);
      try {
        const result = await sendChatMessage({
          message,
          productId: productContext?.productId ?? null,
          barcode: productContext?.barcode ?? null,
          conversationId,
        });
        setConversationId(result.conversation_id);
        if (result.challenge_completions?.[0]) {
          setCompletedChallenge(result.challenge_completions[0]);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now() + 1}`,
            role: "assistant",
            content: result.answer,
            createdAt: new Date().toISOString(),
            sources: result.sources,
            actions: result.actions,
          },
        ]);
      } catch (err) {
        if (err instanceof ChatClientError && err.kind === "unauthorized") {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "FoodGuard AI is temporarily unavailable. Please try again.");
      } finally {
        setPending(false);
      }
    },
    [pending, conversationId, productContext, router],
  );

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ChatHeader
        onNewChat={startNewChat}
        productName={productName}
        brand={brand}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-5 sm:px-6 lg:py-8">
        <div
          ref={listRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto py-4"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.length === 0 && !pending && (
            <ChatEmptyState hasProduct={Boolean(productContext)} />
          )}
          {messages.length === 0 && pending && <ChatTyping />}
          <MessageList messages={messages} />
          {messages.length > 0 && pending && <ChatTyping />}
          {error && <ChatErrorBanner message={error} />}
        </div>
        <QuickActions
          disabled={pending}
          hasProduct={Boolean(productContext)}
          onPick={(text) => void handleSend(text)}
        />
        <ChatInput disabled={pending} onSend={(text) => void handleSend(text)} />
      </main>
      {completedChallenge && (
        <ChallengeCompleteDialog challenge={completedChallenge} onClose={() => setCompletedChallenge(null)} />
      )}
    </div>
  );
}