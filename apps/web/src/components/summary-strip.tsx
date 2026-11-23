import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SummaryMetric = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  unavailable?: boolean;
};

export function SummaryStrip({
  items,
  label,
  columns = 3,
  loading = false,
  unavailable = false,
  className,
}: {
  items: SummaryMetric[];
  label: string;
  columns?: 3 | 4;
  loading?: boolean;
  unavailable?: boolean;
  className?: string;
}) {
  return (
    <dl
      className={cn("summary-strip", `summary-columns-${columns}`, className)}
      aria-label={label}
      aria-busy={loading}
    >
      {items.map(({ label, value, hint, icon: Icon, unavailable: missing }) => (
        <div className="metric" key={label}>
          <dt className="metric-label">
            <span>{label}</span>
            {Icon && <span className="metric-icon"><Icon size={17} aria-hidden="true" /></span>}
          </dt>
          <dd className="metric-value block">{loading || unavailable || missing ? "—" : value}</dd>
          {hint && <dd className="metric-hint">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
