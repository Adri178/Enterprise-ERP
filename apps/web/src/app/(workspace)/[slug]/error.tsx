"use client";
import { id } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="panel flex min-h-72 flex-col items-center justify-center gap-3">
      <h1 className="text-lg font-semibold">{id.error}</h1>
      <p className="text-sm text-muted-foreground">{id.errorHint}</p>
      <Button onClick={reset}>{id.retry}</Button>
    </div>
  );
}
