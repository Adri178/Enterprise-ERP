"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type SessionUser } from "@erp/shared";
import { z } from "zod";
import {
  ArrowRight,
  Boxes,
  Eye,
  EyeOff,
  Loader2,
  Building2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { id } from "@/lib/i18n";
import { isLive, apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
export default function LoginPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  async function submit(values: z.infer<typeof loginSchema>) {
    setError("");
    try {
      const response = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
      });
      if (!response.ok) {
        setError(response.status === 401 ? id.loginFailed : response.status === 403 ? id.loginOriginDenied : response.status === 429 ? id.loginRateLimited : id.loginUnavailable);
        return;
      }
      const profile = await fetch(apiUrl("/auth/me"), { credentials: "include", cache: "no-store" });
      if (!profile.ok) { setError(profile.status === 429 ? id.loginRateLimited : profile.status >= 500 ? id.loginUnavailable : id.loginSessionFailed); return; }
      const user = await profile.json() as SessionUser;
      router.push(user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch {
      setError(id.loginNetworkFailed);
    }
  }
  return (
    <main
      id="main-content"
      className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]"
    >
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#edf3ef] p-14 lg:flex">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Boxes className="text-primary" />
          Enterprise <span className="font-normal text-slate-400">ERP</span>
        </Link>
        <div className="relative z-10 max-w-md">
          <div className="mb-8 flex size-20 items-center justify-center rounded-2xl border border-white bg-white/60 text-primary">
            <LayersMark />
          </div>
          <p className="text-4xl font-medium leading-tight tracking-tight text-[#365347]">
            {id.loginFooter}
          </p>
          <div className="mt-9 space-y-4 text-xs text-[#7b9487]">
            {[
              [Building2, id.multiCompany],
              [Workflow, id.integratedWorkflow],
              [ShieldCheck, id.rolePermissions],
            ].map(([Icon, label]) => {
              const Component = Icon as typeof Building2;
              return (
                <div className="flex items-center gap-3" key={String(label)}>
                  <Component size={17} />
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-[#9aaca0]">
          Enterprise ERP · Portfolio Project
        </p>
        <div className="absolute -bottom-44 -right-32 size-[500px] rounded-full border border-[#dce8df]" />
        <div className="absolute -bottom-24 -right-16 size-[320px] rounded-full border border-[#dce8df]" />
      </section>
      <section className="flex items-center justify-center bg-white px-7 py-14">
        <div className="w-full max-w-[350px]">
          <div className="mb-10 flex items-center gap-2 text-xl font-semibold lg:hidden">
            <Boxes className="text-primary" />
            {id.app}
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            {id.loginTitle}
          </h1>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {id.loginHint}
          </p>
          {isLive && (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit(submit)}>
              <div>
                <label className="field-label" htmlFor="email">
                  {id.email}
                </label>
                <input
                  className="field !h-11"
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="nama@company.com"
                  {...register("email")}
                />
                {errors.email && (
                  <span className="field-error">{errors.email.message}</span>
                )}
              </div>
              <div>
                <label className="field-label" htmlFor="password">
                  {id.password}
                </label>
                <div className="relative">
                  <input
                    className="field !h-11 pr-10"
                    id="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    aria-label={id.password}
                    onClick={() => setVisible((v) => !v)}
                    className="absolute right-3 top-3.5 text-muted-foreground"
                  >
                    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <span className="field-error">{errors.password.message}</span>
                )}
              </div>
              {error && (
                <p role="alert" className="text-xs text-red-600">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowRight />
                )}
                {id.login}
              </Button>
            </form>
          )}
          {!isLive && (
            <div className="mt-8">
              <div className="notice mb-6">{id.demoExplanation}</div>
              <Button asChild className="w-full" size="lg">
                <Link href="/dashboard">
                  {id.enterDemo}
                  <ArrowRight />
                </Link>
              </Button>
              <p className="mt-5 text-[10px] leading-5 text-muted-foreground">
                {id.loginMode}
              </p>
            </div>
          )}
          <p className="mt-12 text-[10px] text-slate-400">
            © 2026 Enterprise ERP
          </p>
        </div>
      </section>
    </main>
  );
}
function LayersMark() {
  return <Boxes size={42} strokeWidth={1.1} />;
}
