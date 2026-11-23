import { cn } from "@/lib/utils";
import { statusLabels } from "@/lib/i18n";
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium",
        ["ACTIVE", "COMPLETED", "APPROVED", "POSTED", "PAID"].includes(status)
          ? "bg-emerald-50 text-emerald-700"
          : ["PENDING", "UNPAID", "RELEASED"].includes(status)
            ? "bg-amber-50 text-amber-700"
            : ["REJECTED", "CANCELLED"].includes(status)
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-500",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status] || status}
    </span>
  );
}
