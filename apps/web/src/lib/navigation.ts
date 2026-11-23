import {
  LayoutDashboard,
  Building2,
  Database,
  ShoppingCart,
  Package,
  ChartNoAxesCombined,
  Calculator,
  Users,
  Factory,
  BarChart3,
  Settings2,
  type LucideIcon,
} from "lucide-react";
export type NavItem = {
  label: string;
  slug: string;
  icon: LucideIcon;
  children?: { label: string; slug: string }[];
  description: string;
};
export const navigation: NavItem[] = [
  {
    label: "Dashboard",
    slug: "dashboard",
    icon: LayoutDashboard,
    description: "Ringkasan operasional company",
  },
  {
    label: "Organization",
    slug: "organization",
    icon: Building2,
    description: "Profil dan struktur company",
    children: [
      { label: "Company", slug: "companies" },
      { label: "Branch", slug: "branches" },
      { label: "Department", slug: "departments" },
    ],
  },
  {
    label: "Master Data",
    slug: "master-data",
    icon: Database,
    description: "Data utama operasional bisnis",
    children: [
      { label: "Items", slug: "items" },
      { label: "Customers", slug: "customers" },
      { label: "Suppliers", slug: "suppliers" },
    ],
  },
  {
    label: "Procurement",
    slug: "procurement",
    icon: ShoppingCart,
    description: "Dari kebutuhan hingga pembelian",
    children: [
      { label: "Purchase Request", slug: "purchase-requests" },
      { label: "Request for Quotation", slug: "requests-for-quotation" },
      { label: "Purchase Order", slug: "purchase-orders" },
      { label: "Purchase Receipt", slug: "purchase-receipts" },
      { label: "Purchase Invoice", slug: "purchase-invoices" },
    ],
  },
  {
    label: "Inventory",
    slug: "inventory",
    icon: Package,
    description: "Warehouse dan pergerakan Stock",
    children: [
      { label: "Warehouses", slug: "warehouses" },
      { label: "Stock Overview", slug: "stock-overview" },
      { label: "Stock Movement", slug: "stock-movement" },
      { label: "Stock Transfer", slug: "stock-transfer" },
      { label: "Stock Adjustment", slug: "stock-adjustment" },
    ],
  },
  {
    label: "Sales & CRM",
    slug: "sales-crm",
    icon: ChartNoAxesCombined,
    description: "Dari peluang hingga penjualan",
    children: [
      { label: "Leads", slug: "leads" },
      { label: "Quotations", slug: "quotations" },
      { label: "Sales Orders", slug: "sales-orders" },
      { label: "Delivery Notes", slug: "delivery-notes" },
      { label: "Sales Invoices", slug: "sales-invoices" },
      { label: "Payments", slug: "sales-payments" },
    ],
  },
  {
    label: "Accounting",
    slug: "accounting",
    icon: Calculator,
    description: "Catatan dan transaksi keuangan",
    children: [
      { label: "Chart of Accounts", slug: "chart-of-accounts" },
      { label: "Journal Entries", slug: "journal-entries" },
      { label: "General Ledger", slug: "general-ledger" },
      { label: "Trial Balance", slug: "trial-balance" },
      { label: "Posting Otomatis", slug: "automatic-accounting" },
      { label: "Payments", slug: "payments" },
      { label: "Accounts Receivable", slug: "accounts-receivable" },
      { label: "Accounts Payable", slug: "accounts-payable" },
    ],
  },
  {
    label: "Human Resources",
    slug: "human-resources",
    icon: Users,
    description: "Data Employee dan organisasi",
    children: [
      { label: "Employees", slug: "employees" },
      { label: "Attendance", slug: "attendance" },
      { label: "Leave Requests", slug: "leave-requests" },
    ],
  },
  {
    label: "Manufacturing",
    slug: "manufacturing",
    icon: Factory,
    description: "Perencanaan dan proses produksi",
    children: [
      { label: "Bill of Materials", slug: "bill-of-materials" },
      { label: "Work Orders", slug: "work-orders" },
      { label: "Production Plan", slug: "production-plan" },
    ],
  },
  {
    label: "Reports & Analytics",
    slug: "reports",
    icon: BarChart3,
    description: "Laporan dan wawasan company",
  },
  {
    label: "Settings & Permissions",
    slug: "settings",
    icon: Settings2,
    description: "Profil User dan hak akses",
    children: [
      { label: "User & Akses", slug: "company-users" },
      { label: "Audit Akses", slug: "access-audit" },
    ],
  },
];
export function resolvePage(slug: string) {
  for (const group of navigation) {
    if (group.slug === slug)
      return { label: group.label, group, isGroup: true };
    const child = group.children?.find((x) => x.slug === slug);
    if (child) return { ...child, group, isGroup: false };
  }
  return null;
}
