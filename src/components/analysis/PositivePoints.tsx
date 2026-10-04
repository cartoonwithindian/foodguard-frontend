import { CheckCircle2 } from "lucide-react";
import type { PositivePoint } from "@/data/analysis-data";

type PositivePointsProps = {
  title: string;
  points: PositivePoint[];
};

export function PositivePoints({ title, points }: PositivePointsProps) {
  if (points.length === 0) return null;

  return (
    <div className="foodguard-card flex flex-col gap-3 border-primary/20 bg-primary-light/45 p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="text-sm text-foreground leading-relaxed">
              {point.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
