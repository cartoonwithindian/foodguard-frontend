"use client";

import { MessagesSquare, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

const extra = [
  {
    id: "assistant",
    title: "Ask FoodGuard",
    subtitle: "AI chat",
    icon: MessagesSquare,
    iconClass: "text-primary",
    href: "/assistant",
  },
  {
    id: "report",
    title: "Report issue",
    subtitle: "Food safety",
    icon: ShieldAlert,
    iconClass: "text-amber-600",
    href: "/food-safety-assistant",
  },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 gap-3">
        {extra.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(item.href)}
            className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <item.icon className={`size-7 shrink-0 ${item.iconClass}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
            </span>
          </button>
        ))}
    </div>
  );
}
