"use client";

import type { ChatMessageView } from "./ChatPage";
import { SourceReferences } from "./SourceReferences";
import { ActionButtons } from "./ActionButtons";

export function MessageBubble({ message }: { message: ChatMessageView }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
          data-testid="chat-user-message"
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="max-w-[92%] rounded-2xl rounded-bl-sm border border-primary/10 bg-secondary px-4 py-3 text-sm leading-relaxed text-foreground"
        data-testid="chat-assistant-message"
      >
        {renderContent(message.content)}
      </div>
      {message.sources && message.sources.length > 0 && (
        <SourceReferences sources={message.sources} />
      )}
      {message.actions && message.actions.length > 0 && (
        <ActionButtons actions={message.actions} />
      )}
    </div>
  );
}

function renderContent(content: string) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) => (
        <p key={index} className="whitespace-pre-wrap">
          {block}
        </p>
      ))}
    </div>
  );
}