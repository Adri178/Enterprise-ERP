"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  CircleHelp,
  ArrowUpRight,
  Building2,
  Command,
  UserRound,
  Settings2,
  Boxes,
  FileText,
} from "lucide-react";
import { navigation, resolvePage } from "@/lib/navigation";
import {
  id,
  purchaseLabels,
  stockOperationLabels,
  salesLabels,
} from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { cn, money } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { CompanySwitcher, WorkspaceUserMenu } from "./workspace-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { TransactionDetail } from "./transaction-dialog";
import { PurchaseDetail } from "./purchase-detail";
import { TradeDetail } from "./trade-detail";
import { StockOperationDetail } from "./stock-operation-detail";
import type {
  Transaction,
  PageResult,
  PurchaseDocument,
  StockOperation,
  SalesDocument,
  Employee,
  LeaveRequest,
  Account,
  Journal,
  Bom,
  WorkOrder,
} from "@erp/shared";
import { useCatalogSearch, useDebouncedValue } from "@/lib/catalog-hooks";
import { useCompanyResource } from "@/lib/company-resource";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const page = resolvePage(pathname.split("/")[1]);
  const { company, user, transactions, refresh } =
    useWorkspace();
  const initials =
    user.name
      .split(/\s+/)
      .slice(0, 2)
      .map((name) => name[0])
      .join("")
      .toUpperCase() || "U";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarCollapsed = collapsed && !mobileOpen;
  const [expanded, setExpanded] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchDocument, setSearchDocument] = useState<Transaction | null>(
    null,
  );
  const [dialog, setDialog] = useState<
    "help" | "notifications" | "profile" | null
  >(null);
  const [read, setRead] = useState(false);
  const [purchaseSelection, setPurchaseSelection] = useState<{
    companyId: string;
    id: string;
  } | null>(null);
  const searchQuery = useDebouncedValue(query);
  const [salesSelection, setSalesSelection] = useState<{
    companyId: string;
    id: string;
  } | null>(null);
  const salesSearch = useCompanyResource<PageResult<SalesDocument>>(
    `sales?q=${encodeURIComponent(searchQuery)}&pageSize=5`,
    0,
    searchOpen && searchQuery.trim().length >= 2,
  );
  const [stockSelection, setStockSelection] = useState<{
    companyId: string;
    id: string;
  } | null>(null);
  const stockSearch = useCompanyResource<PageResult<StockOperation>>(
    `stock/operations?q=${encodeURIComponent(searchQuery)}&pageSize=5`,
    0,
    searchOpen && searchQuery.trim().length >= 2,
  );
  const purchaseSearch = useCompanyResource<PageResult<PurchaseDocument>>(
    `procurement?q=${encodeURIComponent(searchQuery)}&pageSize=5`,
    0,
    searchOpen && searchQuery.trim().length >= 2,
  );
  const employeeSearch = useCompanyResource<PageResult<Employee>>(
    `hr/employees?q=${encodeURIComponent(searchQuery)}&pageSize=5`,
    0,
    searchOpen && searchQuery.trim().length >= 2,
  );
  const leaveSearch = useCompanyResource<PageResult<LeaveRequest>>(
    `hr/leave-requests?q=${encodeURIComponent(searchQuery)}&pageSize=5`,
    0,
    searchOpen && searchQuery.trim().length >= 2,
  );
  const accountSearch = useCompanyResource<PageResult<Account>>(
    `accounting/accounts?q=${encodeURIComponent(searchQuery)}&pageSize=5`,
    0,
    searchOpen && searchQuery.trim().length >= 2,
  );
  const journalSearch = useCompanyResource<PageResult<Journal>>(
    `accounting/journals?q=${encodeURIComponent(searchQuery)}&pageSize=5`,
    0,
    searchOpen && searchQuery.trim().length >= 2,
  );
  const bomSearch = useCompanyResource<PageResult<Bom>>(`manufacturing/boms?q=${encodeURIComponent(searchQuery)}&pageSize=5`, 0, searchOpen && searchQuery.trim().length >= 2);
  const workOrderSearch = useCompanyResource<PageResult<WorkOrder>>(`manufacturing/work-orders?q=${encodeURIComponent(searchQuery)}&pageSize=5`, 0, searchOpen && searchQuery.trim().length >= 2);
  const pendingRequests = useCompanyResource<PageResult<PurchaseDocument>>(
    "procurement?kind=PURCHASE_REQUEST&status=PENDING&pageSize=4",
  );
  const pending = isLive
    ? (pendingRequests.data?.data || []).map((d) => ({
        id: d.id,
        number: d.number,
        party: d.supplierName,
        amount: d.amount,
      }))
    : transactions
        .filter((t) => t.status === "PENDING")
        .slice(0, 4)
        .map((t) => ({ ...t, number: t.id }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
    if (page?.group)
      setExpanded((values) =>
        values.includes(page.group.slug)
          ? values
          : [...values, page.group.slug],
      );
  }, [pathname, page?.group]);
  useEffect(() => {
    setRead(false);
  }, [company.id]);
  useEffect(() => {
    const expire = () => router.replace("/login");
    const changePassword = () => router.replace("/change-password");
    window.addEventListener("erp-session-expired", expire);
    window.addEventListener("erp-password-change-required", changePassword);
    return () => { window.removeEventListener("erp-session-expired", expire); window.removeEventListener("erp-password-change-required", changePassword); };
  }, [router]);
  const searchResults = navigation
    .flatMap((group) => [
      { label: group.label, slug: group.slug, group: id.workspace },
      ...(group.children || []).map((child) => ({
        ...child,
        group: group.label,
      })),
    ])
    .filter((item) =>
      `${item.label} ${item.group}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 10);
  const choose = (slug: string) => {
    router.push(`/${slug}`);
    setSearchOpen(false);
    setQuery("");
  };
  const catalogSearch = useCatalogSearch(query);
  const matchingRecords = catalogSearch.rows;
  const matchingDocuments =
    !isLive && query.length > 1
      ? transactions
          .filter((transaction) =>
            `${transaction.id} ${transaction.party}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .slice(0, 4)
      : [];

  return (
    <div className={cn("app-layout", sidebarCollapsed && "sidebar-collapsed")}>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          aria-label={id.close}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={cn("app-sidebar", mobileOpen && "mobile-open")}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            <Boxes size={23} strokeWidth={1.8} />
          </span>
          {!sidebarCollapsed && (
            <span>
              Enterprise<span className="brand-erp">ERP</span>
            </span>
          )}
        </Link>
        <CompanySwitcher sidebar collapsed={sidebarCollapsed} />
        <nav className="sidebar-nav" aria-label={id.modules}>
          {!sidebarCollapsed && (
            <p className="nav-section-label">{id.workspace}</p>
          )}
          {navigation.map((item, index) => {
            const Icon = item.icon;
            const isActive = page?.group.slug === item.slug;
            const isExpanded = expanded.includes(item.slug);
            return (
              <div key={item.slug}>
                {index === 1 && !sidebarCollapsed && (
                  <p className="nav-section-label mt-5">{id.modules}</p>
                )}
                <div className={cn("nav-row", isActive && "is-active")}>
                  <Link
                    href={`/${item.slug}`}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-current={
                      pathname === `/${item.slug}` ? "page" : undefined
                    }
                    className="nav-link"
                  >
                    <Icon size={18} strokeWidth={1.7} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                  {!!item.children && !sidebarCollapsed && (
                    <button
                      className="nav-expand"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? id.collapseSidebar : id.expandSidebar}: ${item.label}`}
                      onClick={() =>
                        setExpanded((v) =>
                          v.includes(item.slug)
                            ? v.filter((x) => x !== item.slug)
                            : [...v, item.slug],
                        )
                      }
                    >
                      <ChevronDown
                        size={13}
                        className={cn(
                          "transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </button>
                  )}
                </div>
                {!!item.children && isExpanded && !sidebarCollapsed && (
                  <div className="nav-children">
                    {item.children.map((child) => (
                      <Link
                        key={child.slug}
                        href={`/${child.slug}`}
                        aria-current={
                          pathname === `/${child.slug}` ? "page" : undefined
                        }
                        className={cn(
                          "nav-child",
                          pathname === `/${child.slug}` && "child-active",
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          {!sidebarCollapsed && (
            <div className="help-block">
              <CircleHelp size={18} />
              <div>
                <strong>{id.help}</strong>
                <button onClick={() => setDialog("help")}>
                  {id.helpAction}
                  <ArrowUpRight size={12} />
                </button>
              </div>
            </div>
          )}
          <button
            className="sidebar-collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={
              sidebarCollapsed ? id.expandSidebar : id.collapseSidebar
            }
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <>
                <PanelLeftClose size={17} />
                <span>{id.collapseSidebar}</span>
              </>
            )}
          </button>
          <WorkspaceUserMenu compact={sidebarCollapsed} onProfile={() => setDialog("profile")} />
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <button
            className="icon-button mobile-menu-button"
            aria-label={id.expandSidebar}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="header-breadcrumb">
            <span>{id.app}</span>
            <ChevronRight size={13} />
            {page && !page.isGroup && <><Link className="header-parent" href={`/${page.group.slug}`}>{page.group.label}</Link><ChevronRight size={13} /></>}
            <strong>{page?.label || id.dashboard}</strong>
          </div>
          <div className="header-tools">
            <button className="global-search" onClick={() => setSearchOpen(true)} aria-label={id.searchGlobal}>
              <Search size={17} /><span>{id.workspaceUi.search}</span><kbd>Ctrl K</kbd>
            </button>
            <CompanySwitcher />
            <button className="icon-button notification-button" aria-label={id.notifications} onClick={() => setDialog("notifications")}>
              <Bell size={18} />{!read && pending.length > 0 && <i />}
            </button>
            <Link href="/settings" className="icon-button header-settings" aria-label={id.settings}><Settings2 size={18} /></Link>
          </div>
        </header>
        <main id="main-content" className="page-content" key={company.id}>
          {children}
        </main>
        <footer className="app-footer">
          <span>
            Enterprise ERP <span className="mx-1.5 text-slate-300">/</span>{" "}
            {company.code}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            {isLive ? id.live : id.demo}
          </span>
        </footer>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl gap-0 p-0">
          <DialogTitle className="sr-only">{id.searchGlobal}</DialogTitle>
          <DialogDescription className="sr-only">
            {id.modules}
          </DialogDescription>
          <div className="flex items-center gap-3 border-b px-5 py-4 pr-12">
            <Search size={20} className="text-muted-foreground" />
            <input
              autoFocus
              className="w-full bg-transparent text-sm outline-none"
              placeholder={id.searchGlobal}
              maxLength={120}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {searchResults.map((item) => (
              <button
                key={item.slug}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted focus:bg-muted"
                onClick={() => choose(item.slug)}
              >
                <Command size={16} className="text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {item.group}
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {matchingRecords.map((record) => (
              <button
                key={record.id}
                onClick={() =>
                  choose(`${record.kind}?q=${encodeURIComponent(record.code)}`)
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
              >
                <Building2 size={16} className="text-muted-foreground" />
                <span className="flex-1">
                  {record.name}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {record.code}
                  </span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {matchingDocuments.map((transaction) => (
              <button
                key={transaction.id}
                onClick={() => {
                  setSearchDocument(transaction);
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
              >
                <FileText size={16} className="text-muted-foreground" />
                <span className="flex-1">
                  {transaction.id}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {transaction.party}
                  </span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {purchaseSearch.data?.data.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  setPurchaseSelection({ companyId: company.id, id: doc.id });
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
              >
                <FileText size={16} className="text-muted-foreground" />
                <span className="flex-1">
                  {doc.number}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {purchaseLabels[doc.kind]} · {doc.supplierName}
                  </span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {stockSearch.data?.data.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  setStockSelection({ companyId: company.id, id: doc.id });
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
              >
                <Boxes size={16} className="text-muted-foreground" />
                <span className="flex-1">
                  {doc.number}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {stockOperationLabels[doc.kind]} · {doc.warehouseName}
                  </span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {stockSearch.loading && (
              <p
                role="status"
                className="px-3 py-3 text-xs text-muted-foreground"
              >
                {id.loading}
              </p>
            )}
            {salesSearch.data?.data.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  setSalesSelection({ companyId: company.id, id: doc.id });
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
              >
                <FileText size={16} className="text-muted-foreground" />
                <span className="flex-1">
                  {doc.number}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {salesLabels[doc.kind]} · {doc.customerName}
                  </span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {employeeSearch.data?.data.map((employee) => (
              <button
                key={employee.id}
                onClick={() =>
                  choose(`employees?q=${encodeURIComponent(employee.code)}`)
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
              >
                <UserRound size={16} className="text-muted-foreground" />
                <span className="flex-1">
                  {employee.name}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {id.employee} · {employee.code}
                  </span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {leaveSearch.data?.data.map((leave) => (
              <button
                key={leave.id}
                onClick={() =>
                  choose(`leave-requests?q=${encodeURIComponent(leave.number)}`)
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
              >
                <FileText size={16} className="text-muted-foreground" />
                <span className="flex-1">
                  {leave.number}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {id.leaveRequest} · {leave.employeeName}
                  </span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {accountSearch.data?.data.map((account) => (
              <button key={account.id} onClick={() => choose(`chart-of-accounts?q=${encodeURIComponent(account.code)}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted">
                <FileText size={16} className="text-muted-foreground" />
                <span className="flex-1">{account.code} · {account.name}<span className="mt-1 block text-[10px] text-muted-foreground">{id.chartOfAccounts}</span></span><ArrowUpRight size={14} />
              </button>
            ))}
            {journalSearch.data?.data.map((journal) => (
              <button key={journal.id} onClick={() => choose(`journal-entries?q=${encodeURIComponent(journal.number)}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted">
                <FileText size={16} className="text-muted-foreground" />
                <span className="flex-1">{journal.number}<span className="mt-1 block text-[10px] text-muted-foreground">{id.journalEntry} · {journal.reference || journal.description.slice(0, 50)}</span></span><ArrowUpRight size={14} />
              </button>
            ))}
            {bomSearch.data?.data.map((b) => <button key={b.id} onClick={() => choose(`bill-of-materials?q=${encodeURIComponent(b.code)}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"><Boxes size={16} className="text-muted-foreground" /><span className="flex-1">{b.code} · {b.name}<span className="mt-1 block text-[10px] text-muted-foreground">{id.bom} · {b.outputName}</span></span><ArrowUpRight size={14} /></button>)}
            {workOrderSearch.data?.data.map((w) => <button key={w.id} onClick={() => choose(`work-orders?q=${encodeURIComponent(w.number)}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"><FileText size={16} className="text-muted-foreground" /><span className="flex-1">{w.number}<span className="mt-1 block text-[10px] text-muted-foreground">{id.workOrder} · {w.outputName}</span></span><ArrowUpRight size={14} /></button>)}
            {(bomSearch.loading || workOrderSearch.loading) && <p role="status" className="px-3 py-3 text-xs text-muted-foreground">{id.loading}</p>}
            {(bomSearch.error || workOrderSearch.error) && <p role="alert" className="px-3 py-3 text-xs text-red-600">{bomSearch.error || workOrderSearch.error}</p>}
            {(accountSearch.loading || journalSearch.loading) && <p role="status" className="px-3 py-3 text-xs text-muted-foreground">{id.loading}</p>}
            {(accountSearch.error || journalSearch.error) && <p role="alert" className="px-3 py-3 text-xs text-red-600">{accountSearch.error || journalSearch.error}</p>}
            {(employeeSearch.loading || leaveSearch.loading) && (
              <p
                role="status"
                className="px-3 py-3 text-xs text-muted-foreground"
              >
                {id.loading}
              </p>
            )}
            {(employeeSearch.error || leaveSearch.error) && (
              <p role="alert" className="px-3 py-3 text-xs text-red-600">
                {employeeSearch.error || leaveSearch.error}
              </p>
            )}
            {salesSearch.error && (
              <p role="alert" className="px-3 py-3 text-xs text-red-600">
                {salesSearch.error}
              </p>
            )}
            {salesSearch.loading && (
              <p
                role="status"
                className="px-3 py-3 text-xs text-muted-foreground"
              >
                {id.loading}
              </p>
            )}
            {stockSearch.error && (
              <p role="alert" className="px-3 py-3 text-xs text-red-600">
                {stockSearch.error}
              </p>
            )}
            {purchaseSearch.loading && (
              <p
                role="status"
                className="px-3 py-3 text-xs text-muted-foreground"
              >
                {id.loading}
              </p>
            )}
            {purchaseSearch.error && (
              <p role="alert" className="px-3 py-3 text-xs text-red-600">
                {purchaseSearch.error}
              </p>
            )}
            {catalogSearch.loading && (
              <p
                className="px-3 py-3 text-xs text-muted-foreground"
                role="status"
              >
                {id.loading}
              </p>
            )}
            {catalogSearch.error && (
              <p className="px-3 py-3 text-xs text-red-600" role="alert">
                {catalogSearch.error}
              </p>
            )}
            {searchResults.length +
              matchingRecords.length +
              matchingDocuments.length +
              (purchaseSearch.data?.data.length || 0) +
              (stockSearch.data?.data.length || 0) +
              (salesSearch.data?.data.length || 0) +
              (employeeSearch.data?.data.length || 0) +
              (leaveSearch.data?.data.length || 0) +
              (accountSearch.data?.data.length || 0) +
              (bomSearch.data?.data.length || 0) +
              (workOrderSearch.data?.data.length || 0) +
              (journalSearch.data?.data.length || 0) ===
              0 &&
              !catalogSearch.loading &&
              !catalogSearch.error &&
              !purchaseSearch.loading &&
              !purchaseSearch.error &&
              !stockSearch.loading &&
              !stockSearch.error &&
              !salesSearch.error &&
              !employeeSearch.loading &&
              !employeeSearch.error &&
              !leaveSearch.loading &&
              !leaveSearch.error &&
              !accountSearch.loading && !accountSearch.error &&
              !bomSearch.loading && !bomSearch.error && !workOrderSearch.loading && !workOrderSearch.error &&
              !journalSearch.loading && !journalSearch.error &&
              !salesSearch.loading && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {id.noResults}
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            {dialog === "help"
              ? id.helpAction
              : dialog === "profile"
                ? id.profile
                : id.notifications}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {dialog === "help"
              ? id.helpDescription
              : dialog === "profile"
                ? id.activeCompany
                : id.approvalSubtitle}
          </DialogDescription>
          {dialog === "help" && (
            <div className="rounded-lg bg-muted p-4 text-sm leading-6">
              <strong>{isLive ? id.live : id.demoNotice}</strong>
              <p className="mt-1 text-muted-foreground">
                {isLive ? id.companyScope : id.demoExplanation}
              </p>
            </div>
          )}
          {dialog === "profile" && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="avatar size-12">{initials}</span>
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-medium">{company.name}</p>
                <p className="mt-1 text-muted-foreground">
                  {id.role}: {company.role}
                </p>
              </div>
            </div>
          )}
          {dialog === "notifications" && (
            <div className="space-y-2">
              {pendingRequests.error && isLive ? (
                <p role="alert" className="field-error">
                  {pendingRequests.error}
                </p>
              ) : pendingRequests.loading && isLive ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {id.loading}
                </p>
              ) : read || pending.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {id.noNotifications}
                </p>
              ) : (
                pending.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setDialog(null);
                      if (isLive)
                        setPurchaseSelection({
                          companyId: company.id,
                          id: t.id,
                        });
                      else
                        setSearchDocument(
                          transactions.find((row) => row.id === t.id) || null,
                        );
                    }}
                    className="flex w-full gap-3 rounded-lg border p-3 text-left hover:bg-muted"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <FileText size={17} />
                    </span>
                    <span>
                      <strong className="block text-xs">{t.number}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t.party} · {money(t.amount, company.currency)}
                      </span>
                    </span>
                  </button>
                ))
              )}
              {!read && pending.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setRead(true)}
                >
                  {id.markRead}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <TransactionDetail
        transaction={searchDocument}
        onClose={() => setSearchDocument(null)}
      />
      {purchaseSelection?.companyId === company.id && (
        <PurchaseDetail
          key={`${company.id}:${purchaseSelection.id}`}
          documentId={purchaseSelection.id}
          onClose={() => setPurchaseSelection(null)}
          onChanged={refresh}
        />
      )}
      {stockSelection?.companyId === company.id && (
        <StockOperationDetail
          key={`${company.id}:${stockSelection.id}`}
          documentId={stockSelection.id}
          onClose={() => setStockSelection(null)}
          onChanged={refresh}
        />
      )}
      {salesSelection?.companyId === company.id && (
        <TradeDetail
          domain="sales"
          key={`${company.id}:${salesSelection.id}`}
          documentId={salesSelection.id}
          onClose={() => setSalesSelection(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
