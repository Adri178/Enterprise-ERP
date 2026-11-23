import Link from "next/link";
import { cn } from "@/lib/utils";
import { id } from "@/lib/i18n";
export function SettingsLinks({ current }: { current: string }) { return <nav aria-label={id.settings} className="mb-5 flex flex-wrap gap-1 border-b">{[["settings", id.profile], ["company-users", id.usersAccess], ["access-audit", id.accessAudit]].map(([slug, label]) => <Link key={slug} href={`/${slug}`} aria-current={current === slug ? "page" : undefined} className={cn("border-b-2 px-4 py-3 text-xs transition-colors", current === slug ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-primary")}>{label}</Link>)}</nav>; }
