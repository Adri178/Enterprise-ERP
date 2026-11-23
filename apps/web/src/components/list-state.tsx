"use client";
import { Loader2 } from "lucide-react";
import { id } from "@/lib/i18n";
import { Button } from "./ui/button";
export function ResourceState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <div className="empty-state" role="alert"><h2>{id.error}</h2><p>{error}</p><Button variant="outline" className="mt-4" onClick={retry}>{id.retry}</Button></div>
    : <div className="empty-state" role="status"><Loader2 className="animate-spin" /><p>{id.loading}</p></div>;
}
export function ListPagination({ meta, loading, onPage }: { meta?: { total: number; page: number; pageCount: number; pageSize: number }; loading: boolean; onPage: (page: number) => void }) {
  const page = meta?.page || 1, total = meta?.total || 0, size = meta?.pageSize || 10;
  return <div className="list-pagination"><span>{id.showing(total ? (page - 1) * size + 1 : 0, Math.min(page * size, total), total)}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>{id.previous}</Button><Button size="sm" variant="outline" disabled={loading || page >= (meta?.pageCount || 1)} onClick={() => onPage(page + 1)}>{id.next}</Button></div></div>;
}
