import { ArrowDown } from "lucide-react";
import { formatMinute, seriesKey } from "@/lib/daylight";
import type { DaylightPoint, Place } from "@/types";

interface Props {
  points: DaylightPoint[];
  place: Place;
  use24Hour: boolean;
}

const HOUR_MARKS = [0, 6, 12, 18, 24];

function DayTrack({
  sunrise,
  sunset,
  use24Hour,
}: {
  sunrise: number;
  sunset: number;
  use24Hour: boolean;
}) {
  const left = (sunrise / 1440) * 100;
  const width = ((sunset - sunrise) / 1440) * 100;

  return (
    <div className="space-y-1.5">
      <div className="relative h-11 overflow-hidden rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 ring-1 ring-inset ring-white/10 dark:from-slate-900 dark:to-slate-950">
        <div
          className="absolute inset-y-0 bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 transition-[left,width] duration-500 ease-out"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        {HOUR_MARKS.slice(1, -1).map((hour) => (
          <div
            key={hour}
            className="absolute inset-y-0 w-px bg-white/15"
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        ))}
      </div>
      <div className="text-muted-foreground tabular flex justify-between text-[11px]">
        <span>
          Sunrise <span className="text-foreground font-medium">{formatMinute(sunrise, use24Hour)}</span>
        </span>
        <span>
          Sunset <span className="text-foreground font-medium">{formatMinute(sunset, use24Hour)}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Shows the same winter day twice — once per clock policy — using the visitor's
 * own primary location, so the one-hour shift is concrete rather than abstract.
 */
export function ClockShiftDiagram({ points, place, use24Hour }: Props) {
  const winter = points.find((point) => point.isoDate.endsWith("-12-21")) ?? points.at(-1);
  if (!winter) return null;

  const currentRise = winter[seriesKey(place.id, "sunrise", "current")];
  const currentSet = winter[seriesKey(place.id, "sunset", "current")];
  const proposedRise = winter[seriesKey(place.id, "sunrise", "permanentDst")];
  const proposedSet = winter[seriesKey(place.id, "sunset", "permanentDst")];

  if (
    typeof currentRise !== "number" ||
    typeof currentSet !== "number" ||
    typeof proposedRise !== "number" ||
    typeof proposedSet !== "number"
  ) {
    return null;
  }

  const daylightMinutes = Math.round(currentSet - currentRise);
  const hours = Math.floor(daylightMinutes / 60);
  const minutes = daylightMinutes % 60;

  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          December 21 in {place.city}, {place.state}
        </h3>
        <span className="text-muted-foreground text-xs">
          {hours}h {minutes}m of daylight, either way
        </span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Current law
          </span>
          <DayTrack sunrise={currentRise} sunset={currentSet} use24Hour={use24Hour} />
        </div>

        <div className="flex items-center gap-3 py-0.5">
          <ArrowDown className="text-sun size-4 shrink-0" aria-hidden="true" />
          <span className="text-sun text-xs font-medium">
            The whole window slides one hour later
          </span>
          <span className="bg-border h-px flex-1" />
        </div>

        <div className="space-y-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Permanent DST
          </span>
          <DayTrack sunrise={proposedRise} sunset={proposedSet} use24Hour={use24Hour} />
        </div>
      </div>

      <div className="text-muted-foreground/70 tabular mt-4 flex justify-between border-t pt-3 text-[10px]">
        {HOUR_MARKS.map((hour) => (
          <span key={hour}>{hour === 0 || hour === 24 ? "12a" : hour === 12 ? "12p" : `${hour % 12}${hour < 12 ? "a" : "p"}`}</span>
        ))}
      </div>
    </div>
  );
}
