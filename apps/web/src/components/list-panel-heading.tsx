import { number } from "@/lib/utils";

export function ListPanelHeading({ title, count, context }: {
  title: string;
  count?: number;
  context?: string;
}) {
  return (
    <div className="list-panel-heading">
      <h2>{title}<span className="list-record-count">{count == null ? "—" : number(count)}</span></h2>
      {context && <span className="list-panel-context">{context}</span>}
    </div>
  );
}
