"use client";
import { Building2, Check, ChevronsUpDown, LogOut, MoreHorizontal, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, isLive } from "@/lib/api";
import { cn } from "@/lib/utils";
import { id } from "@/lib/i18n";
import { useWorkspace } from "./workspace-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

export function CompanySwitcher({ sidebar = false, collapsed = false }: { sidebar?: boolean; collapsed?: boolean }) {
  const { company, companies, switchCompany } = useWorkspace();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className={cn(sidebar ? "sidebar-workspace" : "company-switcher", collapsed && "workspace-compact")} aria-label={id.companyPicker} title={collapsed ? company.name : undefined}>
        {sidebar ? <span className="workspace-emblem"><Building2 size={20} /></span> : <span className="company-dot" />}
        {!collapsed && <>
          <span className={sidebar ? "workspace-company" : "company-name"}>
            {sidebar ? <><strong>{company.name}</strong><small>{id.workspaceUi.name}</small></> : company.name}
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
        </>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align={sidebar ? "start" : "end"} side={sidebar ? "right" : "bottom"} className="w-80 max-w-[calc(100vw-2rem)]">
      <div className="px-3 py-2"><p className="text-xs font-semibold">{id.companyPicker}</p><p className="mt-1 text-[11px] text-muted-foreground">{id.accessCompany}</p></div>
      <DropdownMenuSeparator />
      {companies.map(c => <DropdownMenuItem key={c.id} onSelect={() => switchCompany(c.id)} className="py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-xs font-semibold text-primary">{c.code}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.name}</span><span className="text-[11px] text-muted-foreground">{c.city} · {c.role}{c.status === "INACTIVE" ? ` · ${id.inactive}` : ""}</span></span>
        {company.id === c.id && <Check className="text-primary" />}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function WorkspaceUserMenu({ onProfile, compact = false }: { onProfile: () => void; compact?: boolean }) {
  const { user, company } = useWorkspace();
  const router = useRouter();
  const initials = user.name.split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "U";
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className={cn("sidebar-account", compact && "account-compact")} aria-label={id.profile}>
        <span className="avatar">{initials}</span>
        {!compact && <><span className="account-label"><strong>{user.name}</strong><small>{company.role} · {company.code}</small></span><MoreHorizontal size={18} /></>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" className="w-64">
      <div className="px-3 py-2"><p className="text-sm font-semibold">{user.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p></div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onProfile}><UserRound />{id.profile}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => router.push("/settings")}><Settings2 />{id.settings}</DropdownMenuItem>
      {isLive && <DropdownMenuItem onSelect={() => router.push("/change-password")}><ShieldCheck />{id.passwordChange}</DropdownMenuItem>}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={async () => { if (isLive) await api("/auth/logout", { method: "POST" }); router.push("/login"); }}><LogOut />{id.logout}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
