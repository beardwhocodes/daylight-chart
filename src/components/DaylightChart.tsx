import { DateTime } from "luxon";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeriesSwatch } from "@/components/SeriesControls";
import { chartPalette } from "@/lib/chart-theme";
import { formatMinute, parseTime, scenarioOffsets, SCENARIO_LABELS } from "@/lib/daylight";
import { useTheme } from "@/hooks/useTheme";
import type { DaylightPoint, Place, ScheduleMarker, SeriesDefinition } from "@/types";

interface Props {
  points: DaylightPoint[];
  series: SeriesDefinition[];
  hiddenSeries: string[];
  places: Place[];
  year: number;
  markers: ScheduleMarker[];
  use24Hour: boolean;
}

interface TooltipEntry {
  dataKey?: string;
  value?: number;
  color?: string;
}

const MONTH_TICKS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const start = DateTime.local(year, month, 1);
  const offset = (weekday - start.weekday + 7) % 7;
  return start.plus({ days: offset + (occurrence - 1) * 7 });
}

export function DaylightChart({ points, series, hiddenSeries, places, year, markers, use24Hour }: Props) {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const visibleSeries = series.filter((definition) => !hiddenSeries.includes(definition.key));
  const seriesMap = new Map(series.map((definition) => [definition.key, definition]));

  const domain = useMemo(() => {
    const values = points.flatMap((point) =>
      visibleSeries
        .map(({ key }) => point[key])
        .filter((value): value is number => typeof value === "number"),
    );
    markers.forEach((marker) => values.push(parseTime(marker.time)));
    if (!values.length) return [240, 1260];
    const low = Math.max(0, Math.floor((Math.min(...values) - 45) / 60) * 60);
    const high = Math.min(1440, Math.ceil((Math.max(...values) + 45) / 60) * 60);
    return [low, high];
  }, [markers, points, visibleSeries]);

  const ticks = Array.from(
    { length: Math.floor((domain[1] - domain[0]) / 120) + 1 },
    (_, index) => domain[0] + index * 120,
  );
  const dstStartDay = Math.floor(nthWeekday(year, 3, 7, 2).diff(DateTime.local(year, 1, 1), "days").days) + 1;
  const dstEndDay = Math.floor(nthWeekday(year, 11, 7, 1).diff(DateTime.local(year, 1, 1), "days").days) + 1;
  const showDstMarkers =
    places.some((place) => scenarioOffsets(place.timezone, year).observesDst) &&
    series.some((item) => item.scenario === "current");

  return (
    <div
      className="tabular relative h-[440px] w-full sm:h-[500px]"
      role="img"
      aria-label={`Sunrise and sunset chart for ${places.map((place) => `${place.city}, ${place.state}`).join(", ")} in ${year}. The horizontal axis is day of year and the vertical axis is local clock time.`}
    >
      <div className="h-full w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, points.length]}
              ticks={MONTH_TICKS}
              tickFormatter={(day) => points[Number(day) - 1]?.dateLabel.split(" ")[0] ?? ""}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: palette.axis, fontSize: 11 }}
            />
            <YAxis
              domain={domain}
              ticks={ticks}
              tickFormatter={(minute) => formatMinute(minute, use24Hour).replace(/:00 /, " ")}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={use24Hour ? 44 : 58}
              tick={{ fill: palette.axis, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: palette.cursor, strokeWidth: 1, strokeDasharray: "3 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const day = points[Number(label) - 1];
                const entries = (payload as unknown as readonly TooltipEntry[])
                  .filter((entry) => entry.dataKey && typeof entry.value === "number")
                  .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
                return (
                  <div className="bg-popover/95 min-w-56 max-w-96 rounded-lg border p-3 shadow-xl shadow-black/15 backdrop-blur-md dark:shadow-black/50">
                    <div className="mb-2 text-[13px] font-semibold">
                      {day?.dateLabel}, {year}
                    </div>
                    {/* The swatch repeats the line's own color AND dash pattern.
                        Color alone is ambiguous: it encodes location, so every row
                        of a single-location chart would look identical. */}
                    <div className="grid gap-1.5">
                      {entries.map((entry) => {
                        const definition = seriesMap.get(entry.dataKey!);
                        if (!definition) return null;
                        return (
                          <div
                            key={entry.dataKey}
                            className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 text-xs"
                          >
                            <SeriesSwatch
                              color={entry.color ?? palette.series[definition.placeIndex]}
                              scenario={definition.scenario}
                              className="w-6"
                            />
                            <span className="text-muted-foreground truncate">{definition.label}</span>
                            <b className="tabular font-semibold">
                              {formatMinute(entry.value, use24Hour)}
                            </b>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />

            {showDstMarkers && (
              <>
                <ReferenceLine
                  x={dstStartDay}
                  stroke={palette.reference}
                  strokeDasharray="2 5"
                  label={{
                    value: "Clocks advance",
                    position: "insideTopRight",
                    fill: palette.referenceLabel,
                    fontSize: 10,
                  }}
                />
                <ReferenceLine
                  x={dstEndDay}
                  stroke={palette.reference}
                  strokeDasharray="2 5"
                  label={{
                    value: "Clocks return",
                    position: "insideTopLeft",
                    fill: palette.referenceLabel,
                    fontSize: 10,
                  }}
                />
              </>
            )}

            {markers.map((marker) => (
              <ReferenceLine
                key={marker.id}
                y={parseTime(marker.time)}
                stroke={palette.marker}
                strokeDasharray="3 5"
                label={{
                  value: marker.label,
                  position: "insideBottomRight",
                  fill: palette.marker,
                  fontSize: 11,
                }}
              />
            ))}

            {visibleSeries.map((definition) => {
              const isTwilight = definition.event === "dawn" || definition.event === "dusk";
              return (
                <Line
                  key={definition.key}
                  dataKey={definition.key}
                  name={definition.label}
                  type="monotone"
                  stroke={palette.series[definition.placeIndex]}
                  strokeWidth={isTwilight ? 1.25 : 2}
                  strokeOpacity={isTwilight ? 0.5 : 1}
                  strokeLinecap="round"
                  strokeDasharray={
                    definition.scenario === "current"
                      ? undefined
                      : definition.scenario === "permanentDst"
                        ? "9 5"
                        : "2 5"
                  }
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: palette.dotRing }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-muted-foreground/70 absolute right-1 -bottom-1 text-[10px]">
        Local clock time · {places.map((place) => place.timezone.replace(/_/g, " ").split("/").at(-1)).join(" · ")}
      </div>
      <div className="sr-only">
        Solid lines show {SCENARIO_LABELS.current}; long dashes show {SCENARIO_LABELS.permanentDst}; dotted lines show{" "}
        {SCENARIO_LABELS.permanentStandard}.
      </div>
    </div>
  );
}
