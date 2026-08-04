import { ChevronDown, Clock3, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/label";
import { EVENT_LABELS, formatMinute, parseTime, scheduleKindForTime, seriesKey } from "@/lib/daylight";
import type { DaylightPoint, Place, ScheduleMarker } from "@/types";

interface Props {
  markers: ScheduleMarker[];
  points: DaylightPoint[];
  primaryPlace: Place;
  use24Hour: boolean;
  onChange: (markers: ScheduleMarker[]) => void;
}

function countDarkDays(
  points: DaylightPoint[],
  place: Place,
  marker: ScheduleMarker,
  scenario: "current" | "permanentDst",
) {
  const event = marker.kind === "morning" ? "sunrise" : "sunset";
  const key = seriesKey(place.id, event, scenario);
  const target = parseTime(marker.time);
  return points.reduce((count, point) => {
    const eventMinute = point[key];
    if (typeof eventMinute !== "number") return count;
    const isDark = marker.kind === "morning" ? target < eventMinute : target > eventMinute;
    return count + (isDark ? 1 : 0);
  }, 0);
}

export function SchedulePanel({ markers, points, primaryPlace, use24Hour, onChange }: Props) {
  const addMarker = () => {
    if (markers.length >= 2) return;
    const kind = markers.some((marker) => marker.kind === "morning") ? "evening" : "morning";
    onChange([
      ...markers,
      {
        id: crypto.randomUUID(),
        label: kind === "morning" ? "Morning commute" : "Evening commute",
        time: kind === "morning" ? "07:30" : "17:30",
        kind,
      },
    ]);
  };

  const update = (id: string, patch: Partial<ScheduleMarker>) =>
    onChange(
      markers.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        return patch.time ? { ...next, kind: scheduleKindForTime(patch.time) } : next;
      }),
    );

  return (
    <Collapsible className="bg-card group/panel min-w-0 rounded-xl border shadow-sm">
      <CollapsibleTrigger className="hover:bg-accent/40 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <Clock3 className="text-muted-foreground size-4" aria-hidden="true" />
          Add your schedule
          {markers.length > 0 && (
            <Badge variant="secondary" className="tabular">
              {markers.length}
            </Badge>
          )}
        </span>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          Optional
          <ChevronDown
            className="size-4 transition-transform duration-200 group-data-[state=open]/panel:rotate-180"
            aria-hidden="true"
          />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        <div className="space-y-3 border-t px-4 pt-4 pb-4">
          <p className="text-muted-foreground text-sm">
            Place up to two times on the chart and count how often they fall before sunrise or after
            sunset in {primaryPlace.city}.
          </p>

          {markers.map((marker) => {
            const current = countDarkDays(points, primaryPlace, marker, "current");
            const permanent = countDarkDays(points, primaryPlace, marker, "permanentDst");
            const labelId = `marker-label-${marker.id}`;
            const timeId = `marker-time-${marker.id}`;

            return (
              <div key={marker.id} className="bg-muted/40 space-y-3 rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,18rem)_8.5rem_auto] sm:justify-start">
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel asChild>
                      <label htmlFor={labelId}>Label</label>
                    </FieldLabel>
                    <Input
                      id={labelId}
                      value={marker.label}
                      maxLength={28}
                      aria-label={`${marker.label} label`}
                      onChange={(event) => update(marker.id, { label: event.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel asChild>
                      <label htmlFor={timeId}>Time</label>
                    </FieldLabel>
                    <Input
                      id={timeId}
                      type="time"
                      value={marker.time}
                      aria-label={`${marker.label} time`}
                      className="tabular"
                      onChange={(event) => update(marker.id, { time: event.target.value })}
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onChange(markers.filter((item) => item.id !== marker.id))}
                      aria-label={`Remove ${marker.label}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <p className="text-muted-foreground text-xs">
                  At <strong className="text-foreground tabular font-medium">
                    {formatMinute(parseTime(marker.time), use24Hour)}
                  </strong>
                  , it is {marker.kind === "morning" ? "before" : "after"}{" "}
                  {EVENT_LABELS[marker.kind === "morning" ? "sunrise" : "sunset"].toLowerCase()} on{" "}
                  <strong className="text-foreground tabular font-medium">{current} days</strong> under
                  current law and{" "}
                  <strong className="text-foreground tabular font-medium">{permanent} days</strong>{" "}
                  under permanent DST.
                </p>
              </div>
            );
          })}

          {markers.length < 2 && (
            <Button variant="outline" size="sm" onClick={addMarker} aria-label="Add a schedule time">
              <Plus aria-hidden="true" />
              Add a time
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
