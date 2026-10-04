import { cn } from "@/lib/utils";

/** Shared class names that match the Figma food-scanner visual language. */
export const brand = {
  page: "min-h-screen bg-[#f9fafb] text-foreground dark:bg-background",
  card: "rounded-xl border-0 bg-card shadow-sm",
  cardBordered: "rounded-xl border border-border bg-card shadow-sm",
  header:
    "bg-gradient-to-r from-orange-500 to-red-500 text-white",
  headerAlt:
    "bg-gradient-to-r from-purple-500 to-indigo-500 text-white",
  btn:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:from-orange-600 hover:to-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  btnBlock:
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-6 text-sm font-medium text-white shadow-sm transition-all hover:from-orange-600 hover:to-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  btnOutline:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  frost: "rounded-lg bg-white/20",
} as const;

export function brandBtn(className?: string) {
  return cn(brand.btn, className);
}
