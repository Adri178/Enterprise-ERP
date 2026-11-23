"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@erp/shared";
import { Boxes, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, isLive } from "@/lib/api";
import { id } from "@/lib/i18n";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Button } from "@/components/ui/button";
export default function ChangePasswordPage() {
  const router = useRouter(), [user, setUser] = useState<SessionUser | null>(null), [error, setError] = useState(""), [events, setEvents] = useState<{ id: string; action: string; createdAt: string }[]>([]);
  useEffect(() => {
    if (!isLive) return;
    const controller = new AbortController(), expired = () => router.replace("/login"); window.addEventListener("erp-session-expired", expired);
    api<SessionUser>("/auth/me", { signal: controller.signal }).then((profile) => { if (!controller.signal.aborted) setUser(profile); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    api<typeof events>("/auth/security-events", { signal: controller.signal }).then((rows) => { if (!controller.signal.aborted) setEvents(rows); }).catch(() => {});
    return () => { controller.abort(); window.removeEventListener("erp-session-expired", expired); };
  }, [router]);
  return <main id="main-content" className="min-h-dvh bg-muted/40 px-5 py-10 sm:py-16"><div className="mx-auto max-w-md"><div className="mb-8 flex items-center gap-2 text-xl font-semibold tracking-tight"><Boxes className="text-primary" />{id.app}</div><section className="panel p-6 sm:p-8"><ShieldCheck className="mb-4 text-primary" size={26} /><h1 className="text-2xl font-semibold tracking-tight">{id.passwordChange}</h1><p className="mb-6 mt-3 text-xs leading-relaxed text-muted-foreground">{user?.mustChangePassword ? id.passwordRequiredHint : id.passwordChangeHint}</p>{!isLive ? <p className="notice">{id.accessLiveOnly}</p> : error ? <p role="alert" className="field-error">{error}</p> : !user ? <p role="status" className="text-xs text-muted-foreground">{id.loading}</p> : <><p className="mb-5 text-xs font-medium">{user.name} · {user.email}</p>{user.mustChangePassword && <p className="mb-5 text-[11px] text-muted-foreground">{id.passwordChangeHint}</p>}<ChangePasswordForm onChanged={() => { toast.success(id.passwordChanged); router.replace("/login"); }} /><div className="mt-5 flex flex-wrap justify-between gap-3">{!user.mustChangePassword && <Link className="text-link text-xs" href="/settings">{id.passwordBack}</Link>}<Button variant="ghost" size="sm" onClick={async () => { await api("/auth/logout", { method: "POST" }); router.replace("/login"); }}><LogOut />{id.logout}</Button></div></>}</section>{events.length > 0 && <section className="mt-6 border-t pt-5"><h2 className="text-xs font-semibold">{id.passwordSecurityHistory}</h2><ul className="mt-3 space-y-3">{events.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground"><span>{e.action === "ACCOUNT_CREATED" ? id.passwordAccountCreated : id.passwordEventChanged}</span><time dateTime={e.createdAt}>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(e.createdAt))}</time></li>)}</ul></section>}</div></main>;
}
