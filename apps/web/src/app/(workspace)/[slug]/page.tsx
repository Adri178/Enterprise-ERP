import { Suspense } from "react";
import { notFound } from "next/navigation";
import { masterKinds, type MasterKind } from "@erp/shared";
import { navigation, resolvePage } from "@/lib/navigation";
import { Dashboard } from "@/components/dashboard";
import { ProcurementPage } from "@/components/procurement-page";
import { purchaseRoutes } from "@/lib/purchase-navigation";
import { StockLedgerPage } from "@/components/stock-ledger-page";
import { StockOperationsPage } from "@/components/stock-operations-page";
import { SalesPage } from "@/components/sales-page";
import { PaymentsPage } from "@/components/payments-page";
import { ReportsPage } from "@/components/reports-page";
import { EmployeesPage } from "@/components/employees-page";
import { LeavesPage } from "@/components/leaves-page";
import { HumanResourcesPage } from "@/components/human-resources-page";
import { AccountingPage } from "@/components/accounting-page";
import { AutomaticAccountingPage } from "@/components/automatic-accounting-page";
import { AccountsPage } from "@/components/accounts-page";
import { JournalsPage } from "@/components/journals-page";
import { AccountingReportsPage } from "@/components/accounting-reports-page";
import { WorkOrdersPage } from "@/components/work-orders-page";
import { BomsPage } from "@/components/boms-page";
import { ProductionPlanPage } from "@/components/production-plan-page";
import { CompanyUsersPage } from "@/components/company-users-page";
import { AccessAuditPage } from "@/components/access-audit-page";
import { LeadsPage } from "@/components/design/leads-page";
import { RfqPage } from "@/components/rfq-page";
import { AttendancePage } from "@/components/attendance-page";
import { salesRoutes } from "@/lib/sales-navigation";
import { MasterDataPage } from "@/components/master-data-page";
import {
  CompanyPage,
  ModulePage,
  SettingsPage,
  StockPage,
} from "@/components/module-page";
import Loading from "./loading";
export const dynamicParams = false;
export function generateStaticParams() {
  return navigation.flatMap((group) => [
    { slug: group.slug },
    ...(group.children || []).map((child) => ({ slug: child.slug })),
  ]);
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: resolvePage(slug)?.label || "Enterprise ERP" };
}
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = resolvePage(slug);
  if (!page) notFound();
  let content;
  if (slug === "dashboard") content = <Dashboard />;
  else if (slug === "leads") content = <LeadsPage />;
  else if (slug === "requests-for-quotation") content = <RfqPage />;
  else if (slug === "attendance") content = <AttendancePage />;
  else if (slug === "companies") content = <CompanyPage />;
  else if (masterKinds.includes(slug as MasterKind))
    content = (
      <MasterDataPage
        key={slug}
        kind={slug as MasterKind}
        parent={page.group.label}
      />
    );
  else if (slug === "reports") content = <ReportsPage />;
  else if (slug === "accounting") content = <AccountingPage />;
  else if (slug === "automatic-accounting") content = <AutomaticAccountingPage />;
  else if (slug === "chart-of-accounts") content = <AccountsPage />;
  else if (slug === "journal-entries") content = <JournalsPage />;
  else if (slug === "general-ledger") content = <AccountingReportsPage kind="ledger" />;
  else if (slug === "trial-balance") content = <AccountingReportsPage kind="trial" />;
  else if (slug === "human-resources") content = <HumanResourcesPage />;
  else if (slug === "employees") content = <EmployeesPage />;
  else if (slug === "leave-requests") content = <LeavesPage />;
  else if (slug === "settings") content = <SettingsPage />;
  else if (slug === "company-users") content = <CompanyUsersPage />;
  else if (slug === "access-audit") content = <AccessAuditPage />;
  else if (slug === "manufacturing") content = <WorkOrdersPage overview />;
  else if (slug === "bill-of-materials") content = <BomsPage />;
  else if (slug === "work-orders") content = <WorkOrdersPage />;
  else if (slug === "production-plan") content = <ProductionPlanPage />;
  else if (slug === "payments") content = <PaymentsPage />;
  else if (slug === "sales-crm" || slug in salesRoutes)
    content = <SalesPage key={slug} slug={slug} />;
  else if (slug === "procurement" || slug in purchaseRoutes)
    content = <ProcurementPage key={slug} slug={slug} />;
  else if (slug === "stock-movement") content = <StockLedgerPage ledger />;
  else if (slug === "stock-transfer")
    content = <StockOperationsPage kind="TRANSFER" />;
  else if (slug === "stock-adjustment")
    content = <StockOperationsPage kind="ADJUSTMENT" />;
  else if (slug === "stock-overview") content = <StockPage />;
  else if (page.isGroup) content = <ModulePage slug={page.group.slug} />;
  else notFound();
  return <Suspense fallback={<Loading />}>{content}</Suspense>;
}
