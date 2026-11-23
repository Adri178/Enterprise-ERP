import { type ReactNode } from "react";
import { id } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { ChevronRight } from "lucide-react";
export function PageHeader({
  title,
  description,
  parent,
  actions,
}: {
  title: string;
  description: string;
  parent?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {parent && (
          <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            {parent}
            <ChevronRight size={12} />
            <span>{title}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1>{title}</h1>
          {!isLive && <span className="demo-label">{id.demoShort}</span>}
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="page-heading-actions">{actions}</div>
    </div>
  );
}
