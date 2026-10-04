import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm",
        className ?? "size-8",
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("size-5", iconClassName)}
      >
        <path
          d="M24 8c-2.5 0-4.5 2-4.5 4.5v2.2c-6.2 1.4-10.5 7-10.5 13.3 0 7.7 6.3 14 14 14s14-6.3 14-14c0-6.3-4.3-11.9-10.5-13.3V12.5C28.5 10 26.5 8 24 8z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 22h8M24 18v8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="34" cy="34" r="7" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M38.5 38.5L42 42"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
