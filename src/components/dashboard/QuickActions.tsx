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
            className="rounded-xl bg-card p-4 text-center shadow-sm transition-shadow hover:shadow-md"
          >
            <item.icon className={`mx-auto mb-2 size-8 ${item.iconClass}`} aria-hidden="true" />
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          </button>
        ))}
    </div>
  );
}
