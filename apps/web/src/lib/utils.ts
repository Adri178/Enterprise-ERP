import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const money = (amount: number, currency = "IDR", compact = false) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    ...(currency === "IDR"
      ? {
          minimumFractionDigits: 0,
          maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        }
      : {}),
    ...(compact
      ? {
          notation: "compact" as const,
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        }
      : {}),
  }).format(amount);
export const number = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value);
// Format server decimal strings without converting large totals to floating point.
export function exactMoney(value: string, currency = "IDR") {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return "—";
  const [, sign, whole, fraction = "00"] = match, negativeFraction = sign === "-" && BigInt(whole) === 0n;
  const integer = negativeFraction ? -1n : BigInt(`${sign}${whole}`);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(integer)
    .map((part) => part.type === "fraction" ? fraction.padEnd(2, "0") : part.type === "integer" && negativeFraction ? "0" : part.value).join("");
}
export const date = (value: string, long = false) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
export function exportCsv(filename: string, rows: (string | number)[][]) {
  const safe = (value: string | number) => {
    const text = String(value);
    return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
