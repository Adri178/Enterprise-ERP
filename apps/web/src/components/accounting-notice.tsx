import { Info } from "lucide-react";
import { isLive } from "@/lib/api";
import { id } from "@/lib/i18n";
export function AccountingNotice() { return <div className="notice mb-5 items-start"><Info size={16} className="mt-0.5 shrink-0" /><p>{isLive ? id.journalScope : id.accountingLiveOnly}</p></div>; }
