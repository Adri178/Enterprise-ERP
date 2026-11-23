"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@erp/shared";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { id } from "@/lib/i18n";
import { Button } from "./ui/button";
export function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
  const [error, setError] = useState("");
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } }), busy = form.formState.isSubmitting;
  return <form className="space-y-5" onSubmit={form.handleSubmit(async (input) => { setError(""); try { await api("/auth/change-password", { method: "POST", body: JSON.stringify(input) }); form.reset(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : id.error); } })}><fieldset disabled={busy} className="space-y-5">{(["currentPassword", "newPassword", "confirmPassword"] as const).map((key) => <label key={key} className="block"><span className="field-label">{key === "currentPassword" ? id.passwordCurrent : key === "newPassword" ? id.passwordNew : id.passwordConfirm} *</span><input className="field !h-11" type="password" maxLength={key === "currentPassword" ? 128 : 72} autoComplete={key === "currentPassword" ? "current-password" : "new-password"} {...form.register(key)} /><span className="field-error">{form.formState.errors[key]?.message}</span></label>)}</fieldset>{error && <p className="field-error" role="alert">{error}</p>}<Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{id.passwordChange}</Button></form>;
}
