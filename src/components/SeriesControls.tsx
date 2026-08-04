import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { chartPalette, seriesColor } from "@/lib/chart-theme";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import type { Scenario, SeriesDefinition } from "@/types";

/** Dash patterns mirror the strokeDasharray values used by the chart lines. */
export const SCENARIO_DASH: Record<Scenario, string> = {
  current: "",
  permanentDst: "repeating-linear-gradient(90deg, currentColor 0 7px, transparent 7px 11px)",
  permanentStandard: "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px)",
};

export function SeriesSwatch({
  color,
  scenario,
  className,
}: {
  color: string;
  scenario: Scenario;
  className?: string;
}) {
  const dash = SCENARIO_DASH[scenario];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-0.5 w-5 shrink-0 rounded-full", className)}
      style={{ color, background: dash || "currentColor" }}
    />
  );
}

interface Props {
  series: SeriesDefinition[];
  hidden: string[];
  onToggle: (key: string) => void;
}

export function SeriesControls({ series, hidden, onToggle }: Props) {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const shownCount = series.filter((definition) => !hidden.includes(definition.key)).length;

  return (
    <Collapsible className="group/series border-t">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-1 py-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        Individual lines
        <span className="text-muted-foreground/70 tabular">
          ({shownCount}/{series.length})
        </span>
        <ChevronDown
          className="size-3.5 transition-transform duration-200 group-data-[state=open]/series:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        <div className="grid gap-x-6 gap-y-1 pb-3 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((definition) => {
            const checked = !hidden.includes(definition.key);
            return (
              <label
                key={definition.key}
                className="hover:bg-accent/40 flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-xs transition-colors"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(definition.key)}
                  aria-label={`Show ${definition.label}`}
                />
                <SeriesSwatch
                  color={seriesColor(palette, definition.event, definition.placeIndex)}
                  scenario={definition.scenario}
                  className={cn(!checked && "opacity-30")}
                />
                <span
                  className={cn(
                    "truncate transition-colors",
                    checked ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {definition.label}
                </span>
              </label>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
