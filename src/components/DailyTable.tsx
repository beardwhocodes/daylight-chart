import { ChevronDown, Table2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatMinute } from "@/lib/daylight";
import type { DaylightPoint, SeriesDefinition } from "@/types";

interface Props {
  points: DaylightPoint[];
  series: SeriesDefinition[];
  use24Hour: boolean;
}

export function DailyTable({ points, series, use24Hour }: Props) {
  return (
    <Collapsible className="bg-card group/table min-w-0 rounded-xl border shadow-sm">
      <CollapsibleTrigger className="hover:bg-accent/40 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <Table2 className="text-muted-foreground size-4" aria-hidden="true" />
          Daily data table
        </span>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="tabular">{points.length} rows</span>
          <ChevronDown
            className="size-4 transition-transform duration-200 group-data-[state=open]/table:rotate-180"
            aria-hidden="true"
          />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        <div className="max-h-[28rem] overflow-auto border-t">
          <table className="tabular w-full border-collapse text-xs">
            <caption className="sr-only">
              Daily local clock times for visible chart lines
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-muted text-muted-foreground sticky top-0 z-10 px-4 py-2.5 text-left font-medium whitespace-nowrap"
                >
                  Date
                </th>
                {series.map((item) => (
                  <th
                    key={item.key}
                    scope="col"
                    className="bg-muted text-muted-foreground sticky top-0 z-10 px-4 py-2.5 text-left font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.isoDate} className="hover:bg-accent/40 border-t transition-colors">
                  <th
                    scope="row"
                    className="text-muted-foreground px-4 py-1.5 text-left font-normal whitespace-nowrap"
                  >
                    {point.dateLabel}
                  </th>
                  {series.map((item) => (
                    <td key={item.key} className="px-4 py-1.5 whitespace-nowrap">
                      {formatMinute(point[item.key] as number | null, use24Hour)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
