"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Users } from "lucide-react";
import type { HrSummary, LeaveRequest, PageResult } from "@erp/shared";
import { useCompanyResource } from "@/lib/company-resource";
import { isLive } from "@/lib/api";
import { id } from "@/lib/i18n";
import { date, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { HrLoading, HrNotice } from "./hr-common";
import { LeaveDetail } from "./leave-detail";
import { Button } from "./ui/button";
export function HumanResourcesPage() {
  const { company } = useWorkspace();
  return <HrWorkspace key={company.id} />;
}
function HrWorkspace() {
  const { company, refresh } = useWorkspace(),
    [selected, setSelected] = useState<string | null>(null);
  const summary = useCompanyResource<HrSummary>("hr/summary"),
    pending = useCompanyResource<PageResult<LeaveRequest>>(
      "hr/leave-requests?status=PENDING&pageSize=6",
    );
  return (
    <>
      <PageHeader
        title={id.hrTitle}
        description={`${company.name} · ${id.hrDescription}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/employees">
              {id.employees}
              <ArrowRight />
            </Link>
          </Button>
        }
      />
      <HrNotice />
      {!isLive ? (
        <div className="panel empty-state">
          <p>{id.hrLiveOnly}</p>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="outline">
              <Link href="/employees">{id.employees}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/leave-requests">{id.leaveRequests}</Link>
            </Button>
          </div>
        </div>
      ) : summary.loading || summary.error ? (
        <div className="panel">
          <HrLoading error={summary.error} retry={refresh} />
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: id.employeeActive, value: summary.data?.active || 0 },
              {
                label: id.employeeInactive,
                value: summary.data?.inactive || 0,
              },
              { label: id.hrPending, value: summary.data?.pending || 0 },
            ].map((card) => (
              <div className="panel metric" key={card.label}>
                <span className="metric-label">{card.label}</span>
                <strong className="metric-value block">
                  {number(card.value)}
                </strong>
              </div>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1.7fr]">
            <section className="panel p-5">
              <h2 className="section-heading">{id.employeeByBranch}</h2>
              <p className="section-description">
                {id.employeeTotal}: {number(summary.data?.total || 0)}
              </p>
              <ul className="mt-4 divide-y divide-border">
                {summary.data?.branches.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 py-4 text-xs"
                  >
                    <span className="font-medium">{b.name}</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-primary">
                      {number(b.active)}
                    </span>
                  </li>
                ))}
              </ul>
              {!summary.data?.branches.length && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  {id.empty}
                </p>
              )}
              <Link
                className="text-link mt-5 flex items-center gap-2 text-xs"
                href="/employees"
              >
                <Users size={14} />
                {id.list(id.employees)}
                <ArrowRight size={13} />
              </Link>
            </section>
            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="section-heading">{id.hrPending}</h2>
                <Link className="text-link text-xs" href="/leave-requests">
                  {id.viewAll}
                </Link>
              </div>
              {pending.loading || pending.error ? (
                <HrLoading error={pending.error} retry={refresh} />
              ) : pending.data?.data.length ? (
                <div className="divide-y divide-border">
                  {pending.data.data.map((row) => (
                    <button
                      className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted"
                      onClick={() => setSelected(row.id)}
                      key={row.id}
                    >
                      <CalendarDays size={17} className="text-primary" />
                      <span className="min-w-0 flex-1">
                        <strong className="block text-xs font-medium">
                          {row.employeeName}
                        </strong>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {row.number} · {date(row.fromDate)} –{" "}
                          {date(row.toDate)}
                        </span>
                      </span>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>{id.empty}</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
      {selected && (
        <LeaveDetail
          documentId={selected}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}
