"use client";
import { Info } from "lucide-react";
import { isLive } from "@/lib/api";
import { id } from "@/lib/i18n";
export { ResourceState as HrLoading, ListPagination as HrPagination } from "./list-state";
export function HrNotice() {
  return (
    <div className="notice mb-5 items-start">
      <Info size={16} className="mt-0.5 shrink-0" />
      <div>
        <p>{isLive ? id.hrScope : id.hrLiveOnly}</p>
        {isLive && <p className="mt-1">{id.hrReviewerHint}</p>}
      </div>
    </div>
  );
}
