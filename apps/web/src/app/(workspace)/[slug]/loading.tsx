import { id } from "@/lib/i18n";
export default function Loading() {
  return (
    <div aria-label={id.loading} className="animate-pulse space-y-6">
      <div className="h-12 w-64 rounded bg-slate-200" />
      <div className="h-32 rounded-xl bg-slate-200/60" />
      <div className="h-80 rounded-xl bg-slate-200/60" />
    </div>
  );
}
