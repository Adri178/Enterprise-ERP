"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  canWrite,
  companySchema,
  emptyCatalogSummary,
  masterKinds,
  normalizeMasterInput,
  type CatalogSummary,
  type Company,
  type CompanyInput,
  type MasterKind,
  type MasterInput,
  type MasterRecord,
  type SessionUser,
  type Transaction,
} from "@erp/shared";
import { toast } from "sonner";
import { api, isLive } from "../lib/api";
import {
  createDemoData,
  restoreDemoData,
  type DemoData,
} from "../lib/demo-data";
import { id } from "../lib/i18n";
type Context = {
  company: Company;
  companies: Company[];
  user: SessionUser;
  loading: boolean;
  error: string | null;
  records: DemoData["records"];
  summary: CatalogSummary;
  revision: number;
  transactions: Transaction[];
  writable: boolean;
  switchCompany: (id: string) => void;
  refresh: () => void;
  saveRecord: (
    kind: MasterKind,
    input: MasterInput,
    id?: string,
    expectedUpdatedAt?: string,
  ) => Promise<void>;
  deleteRecord: (kind: MasterKind, id: string) => Promise<void>;
  saveCompany: (
    input: CompanyInput,
    id?: string,
    expectedUpdatedAt?: string,
  ) => Promise<Company>;
  archiveCompany: (id: string) => Promise<void>;
  addDraft: (input: Omit<Transaction, "id" | "companyId" | "status">) => void;
};
const WorkspaceContext = createContext<Context | null>(null);
const storageKey = "enterprise-erp-demo-v1";
const emptyRecords: DemoData["records"] = {
  branches: [],
  departments: [],
  items: [],
  customers: [],
  suppliers: [],
  warehouses: [],
};
const emptyData: DemoData = {
  companies: [],
  records: emptyRecords,
  transactions: [],
};
const emptyCompany: Company = {
  id: "",
  code: "—",
  name: id.loading,
  industry: "",
  city: "",
  currency: "IDR",
  role: "VIEWER",
  status: "ACTIVE",
  address: "",
  email: "",
  phone: "",
  taxId: "",
};
const defaultUser: SessionUser = {
  id: isLive ? "" : "demo-admin",
  name: isLive ? "" : "Aditya Pratama",
  email: isLive ? "" : "aditya@enterprise.example",
  companies: [],
};
const timestamp = (previous?: string) =>
  new Date(
    Math.max(Date.now(), previous ? new Date(previous).getTime() + 1 : 0),
  ).toISOString();

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(defaultUser);
  const [companyId, setCompanyId] = useState("alpha");
  const [data, setData] = useState<DemoData>(() =>
    isLive ? emptyData : createDemoData(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageValid, setStorageValid] = useState(false);
  const [revision, setRevision] = useState(0);
  const [liveSummary, setLiveSummary] =
    useState<CatalogSummary>(emptyCatalogSummary);
  const companies = useMemo(
    () =>
      isLive
        ? user.companies
        : data.companies.map((company) => ({
            ...company,
            currencyLocked:
              data.transactions.some((t) => t.companyId === company.id) ||
              data.records.items.some(
                (item) =>
                  item.companyId === company.id &&
                  ((item.purchasePrice || 0) > 0 ||
                    (item.sellingPrice || 0) > 0),
              ),
          })),
    [user.companies, data],
  );
  const company =
    companies.find((c) => c.id === companyId) || companies[0] || emptyCompany;
  const writable = canWrite(company.role) && company.status === "ACTIVE";
  const records = useMemo(
    () =>
      Object.fromEntries(
        masterKinds.map((kind) => [
          kind,
          data.records[kind]
            .filter((r) => r.companyId === company.id)
            .map((record) =>
              ["departments", "warehouses"].includes(kind)
                ? {
                    ...record,
                    branchName: data.records.branches.find(
                      (branch) =>
                        branch.companyId === company.id &&
                        branch.id === record.branchId,
                    )?.name,
                  }
                : record,
            ),
        ]),
      ) as DemoData["records"],
    [data.records, company.id],
  );
  const summary = useMemo(() => {
    if (isLive) return liveSummary;
    const result = emptyCatalogSummary();
    for (const kind of masterKinds)
      for (const row of records[kind]) {
        result[kind].total++;
        result[kind][row.status === "ACTIVE" ? "active" : "inactive"]++;
      }
    return result;
  }, [records, liveSummary]);

  useEffect(() => {
    if (isLive) {
      const controller = new AbortController();
      api<SessionUser>("/auth/me", { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.mustChangePassword) { window.dispatchEvent(new Event("erp-password-change-required")); setLoading(false); return; }
          setUser(result);
          let saved: string | null = null;
          try {
            saved = localStorage.getItem(`enterprise-erp-active:${result.id}`);
          } catch {
            /* Optional preference. */
          }
          setCompanyId(
            result.companies.find((c) => c.id === saved)?.id ||
              result.companies[0]?.id ||
              "",
          );
          if (!result.companies.length) {
            setError(id.noCompany);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setLoading(false);
          }
        });
      return () => controller.abort();
    }
    try {
      const saved = localStorage.getItem(storageKey);
      const restored = saved
        ? restoreDemoData(JSON.parse(saved))
        : createDemoData();
      setData(restored);
      setStorageValid(true);
      const savedCompany = localStorage.getItem("enterprise-erp-company");
      if (restored.companies.some((c) => c.id === savedCompany))
        setCompanyId(savedCompany!);
    } catch {
      setError(id.storageInvalid);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isLive || !user.id || !company.id) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setLiveSummary(emptyCatalogSummary());
    setData(emptyData);
    api<Company[]>("/companies", { signal: controller.signal })
      .then(async (updatedCompanies) => {
        if (controller.signal.aborted) return null;
        setUser((previous) => ({ ...previous, companies: updatedCompanies }));
        if (!updatedCompanies.some((c) => c.id === company.id)) {
          setCompanyId(updatedCompanies[0]?.id || "");
          if (!updatedCompanies.length) setError(id.noCompany);
          return null;
        }
        return Promise.all([
          api<CatalogSummary>(`/companies/${company.id}/master-summary`, { signal: controller.signal }),
          api<Transaction[]>(`/companies/${company.id}/documents`, { signal: controller.signal }),
        ] as const);
      })
      .then((result) => {
        if (!controller.signal.aborted && result) {
          setLiveSummary(result[0]);
          setData({ ...emptyData, transactions: result[1] });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [company.id, user.id, revision]);
  useEffect(() => {
    if (!isLive && !loading && storageValid) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        /* Browser persistence is optional. */
      }
    }
  }, [data, loading, storageValid]);
  useEffect(() => {
    if (loading || !company.id) return;
    try {
      localStorage.setItem(
        isLive ? `enterprise-erp-active:${user.id}` : "enterprise-erp-company",
        company.id,
      );
    } catch {
      /* Optional preference. */
    }
  }, [company.id, loading, user.id]);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => { if (!isLive) return; const sync = () => setRevision((v) => v + 1); window.addEventListener("focus", sync); return () => window.removeEventListener("focus", sync); }, []);
  const switchCompany = useCallback(
    (nextId: string) => {
      const next = companies.find((c) => c.id === nextId);
      if (!next) return;
      setCompanyId(nextId);
      try {
        localStorage.setItem(
          isLive
            ? `enterprise-erp-active:${user.id}`
            : "enterprise-erp-company",
          nextId,
        );
      } catch {
        /* Optional preference. */
      }
      toast.success(id.switched(next.name));
    },
    [companies, user.id],
  );

  async function saveRecord(
    kind: MasterKind,
    input: MasterInput,
    recordId?: string,
    expectedUpdatedAt?: string,
  ) {
    if (!writable)
      throw new Error(
        company.status === "INACTIVE" ? id.inactiveCompany : id.readOnly,
      );
    const validated = normalizeMasterInput(kind, input);
    if (isLive) {
      await api(
        `/companies/${company.id}/master/${kind}${recordId ? `/${recordId}` : ""}`,
        {
          method: recordId ? "PATCH" : "POST",
          body: JSON.stringify({ ...validated, expectedUpdatedAt }),
        },
      );
      refresh();
    } else {
      const before = records[kind].find((r) => r.id === recordId);
      if (recordId && !before) throw new Error(id.notFound);
      if (expectedUpdatedAt && before?.updatedAt !== expectedUpdatedAt)
        throw new Error(id.staleRecord);
      if (
        records[kind].some(
          (r) =>
            r.id !== recordId &&
            r.code.toLowerCase() === validated.code.toLowerCase(),
        )
      )
        throw new Error(id.duplicate);
      if (["departments", "warehouses"].includes(kind)) {
        const branch = records.branches.find(
          (r) => r.id === validated.branchId,
        );
        if (
          !branch ||
          (branch.status !== "ACTIVE" && branch.id !== before?.branchId)
        )
          throw new Error(id.branchRequired);
      }
      if (
        kind === "branches" &&
        validated.status === "INACTIVE" &&
        [...records.departments, ...records.warehouses].some(
          (r) => r.branchId === recordId && r.status === "ACTIVE",
        )
      )
        throw new Error(id.branchInUse);
      const now = timestamp(before?.updatedAt);
      const row: MasterRecord = {
        ...validated,
        id: recordId || crypto.randomUUID(),
        companyId: company.id,
        createdAt: before?.createdAt || now,
        updatedAt: now,
      };
      setData((current) => ({
        ...current,
        records: {
          ...current.records,
          [kind]: recordId
            ? current.records[kind].map((r) =>
                r.id === recordId && r.companyId === company.id ? row : r,
              )
            : [row, ...current.records[kind]],
        },
      }));
    }
    toast.success(id.saved);
  }
  async function deleteRecord(kind: MasterKind, recordId: string) {
    if (!writable)
      throw new Error(
        company.status === "INACTIVE" ? id.inactiveCompany : id.readOnly,
      );
    if (isLive) {
      await api(`/companies/${company.id}/master/${kind}/${recordId}`, {
        method: "DELETE",
      });
      refresh();
    } else {
      if (!records[kind].some((r) => r.id === recordId))
        throw new Error(id.notFound);
      if (
        kind === "branches" &&
        [...records.departments, ...records.warehouses].some(
          (r) => r.branchId === recordId,
        )
      )
        throw new Error(id.recordReferenced);
      setData((current) => ({
        ...current,
        records: {
          ...current.records,
          [kind]: current.records[kind].filter(
            (r) => !(r.id === recordId && r.companyId === company.id),
          ),
        },
      }));
    }
    toast.success(id.deleted);
  }
  async function saveCompany(
    input: CompanyInput,
    targetId?: string,
    expectedUpdatedAt?: string,
  ): Promise<Company> {
    const validated = companySchema.parse(input);
    const current = companies.find((c) => c.id === targetId);
    if (
      targetId
        ? current?.role !== "ADMIN"
        : !companies.some((c) => c.role === "ADMIN")
    )
      throw new Error(id.companyAdminOnly);
    let saved: Company;
    if (isLive) {
      saved = await api<Company>(
        `/companies${targetId ? `/${targetId}` : ""}`,
        {
          method: targetId ? "PATCH" : "POST",
          body: JSON.stringify({ ...validated, expectedUpdatedAt }),
        },
      );
      setUser((previous) => ({
        ...previous,
        companies: targetId
          ? previous.companies.map((c) => (c.id === targetId ? saved : c))
          : [...previous.companies, saved],
      }));
    } else {
      if (expectedUpdatedAt && current?.updatedAt !== expectedUpdatedAt)
        throw new Error(id.staleRecord);
      if (current && current.code !== validated.code)
        throw new Error(id.codeImmutable);
      if (current?.currencyLocked && current.currency !== validated.currency)
        throw new Error(id.currencyLocked);
      if (
        companies.some(
          (c) => c.id !== targetId && c.code.toUpperCase() === validated.code,
        )
      )
        throw new Error(id.duplicate);
      saved = {
        ...validated,
        id: targetId || crypto.randomUUID(),
        role: "ADMIN",
        updatedAt: timestamp(current?.updatedAt),
      };
      setData((previous) => ({
        ...previous,
        companies: targetId
          ? previous.companies.map((c) => (c.id === targetId ? saved : c))
          : [...previous.companies, saved],
      }));
    }
    if (!targetId) setCompanyId(saved.id);
    refresh();
    toast.success(targetId ? id.companyUpdated : id.companyCreated);
    return saved;
  }
  async function archiveCompany(targetId: string) {
    const current = companies.find((c) => c.id === targetId);
    if (!current || current.role !== "ADMIN")
      throw new Error(id.companyAdminOnly);
    if (isLive) {
      await api(`/companies/${targetId}`, { method: "DELETE" });
      const next = await api<Company[]>("/companies");
      setUser((previous) => ({ ...previous, companies: next }));
      refresh();
      toast.success(id.companyArchived);
    } else
      await saveCompany(
        { ...current, status: "INACTIVE" },
        targetId,
        current.updatedAt,
      );
  }
  function addDraft(input: Omit<Transaction, "id" | "companyId" | "status">) {
    if (!writable) throw new Error(id.readOnly);
    if (isLive) throw new Error(id.transactionNotLive);
    setData((previous) => ({
      ...previous,
      transactions: [
        {
          ...input,
          id: `DRAFT-${company.code}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          companyId: company.id,
          status: "DRAFT",
        },
        ...previous.transactions,
      ],
    }));
    toast.success(id.draftCreated);
  }
  return (
    <WorkspaceContext.Provider
      value={{
        company,
        companies,
        user: { ...user, companies },
        loading,
        error,
        records,
        summary,
        revision,
        transactions: data.transactions.filter(
          (t) => t.companyId === company.id,
        ),
        writable,
        switchCompany,
        refresh,
        saveRecord,
        deleteRecord,
        saveCompany,
        archiveCompany,
        addDraft,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider diperlukan");
  return value;
}
