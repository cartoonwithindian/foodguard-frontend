import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
};

/**
 * One header pattern for page and section titles: optional eyebrow, one title
 * size per level, optional description and right-aligned actions. Keeps titles
 * aligned to the content grid instead of floating per screen.
 */
export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  as: Tag = "h2",
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <p className="foodguard-eyebrow text-primary">{eyebrow}</p> : null}
        <Tag
          className={cn(
            "font-semibold tracking-tight text-foreground",
            eyebrow ? "mt-2" : "",
            Tag === "h1" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </Tag>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
