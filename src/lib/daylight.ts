import { DateTime } from "luxon";
import SunCalc from "suncalc";
import type { DaylightPoint, EventType, Place, Scenario, SeriesDefinition } from "../types";

export const EVENT_LABELS: Record<EventType, string> = {
  sunrise: "Sunrise",
  sunset: "Sunset",
  dawn: "Civil dawn",
  dusk: "Civil dusk",
};

export const SCENARIO_LABELS: Record<Scenario, string> = {
  current: "Current law",
  permanentDst: "Permanent DST",
  permanentStandard: "Permanent standard",
};

const offsetCache = new Map<string, { standard: number; daylight: number; observesDst: boolean }>();

export function scenarioOffsets(timezone: string, year: number) {
  const cacheKey = `${timezone}|${year}`;
  const cached = offsetCache.get(cacheKey);
  if (cached) return cached;
  const monthlyOffsets = Array.from({ length: 12 }, (_, month) =>
    DateTime.fromObject({ year, month: month + 1, day: 15, hour: 12 }, { zone: timezone }).offset,
  );
  const offsets = {
    standard: Math.min(...monthlyOffsets),
    daylight: Math.max(...monthlyOffsets),
    observesDst: new Set(monthlyOffsets).size > 1,
  };
  offsetCache.set(cacheKey, offsets);
  return offsets;
}

export function minuteForScenario(date: Date, timezone: string, year: number, scenario: Scenario): number | null {
  if (Number.isNaN(date.getTime())) return null;
  const local = DateTime.fromJSDate(date).setZone(timezone);
  const offsets = scenarioOffsets(timezone, year);
  let targetOffset = local.offset;
  if (scenario === "permanentDst" && offsets.observesDst) targetOffset = offsets.daylight;
  if (scenario === "permanentStandard") targetOffset = offsets.standard;
  const minute = local.hour * 60 + local.minute + local.second / 60 + targetOffset - local.offset;
  return ((minute % 1440) + 1440) % 1440;
}

/**
 * Places whose clocks never move, so permanent daylight time would change
 * nothing for them. Both scenario lines then land on top of each other, which
 * reads as a missing line unless the page says why.
 */
export function exemptPlaces(places: Place[], year: number): Place[] {
  return places.filter((place) => !scenarioOffsets(place.timezone, year).observesDst);
}

export function seriesKey(placeId: string, event: EventType, scenario: Scenario) {
  return `${placeId}|${event}|${scenario}`;
}

export function buildSeries(places: Place[], events: EventType[], scenarios: Scenario[]): SeriesDefinition[] {
  // The city only earns a place in the label when there is more than one to tell
  // apart. With a single location it repeats the heading on every line.
  const nameThePlace = places.length > 1;
  return places.flatMap((place, placeIndex) =>
    events.flatMap((event) =>
      scenarios.map((scenario) => ({
        key: seriesKey(place.id, event, scenario),
        placeId: place.id,
        placeIndex,
        event,
        scenario,
        label: `${nameThePlace ? `${place.city} ` : ""}${EVENT_LABELS[event]} — ${SCENARIO_LABELS[scenario]}`,
      })),
    ),
  );
}

export function calculateYear(places: Place[], year: number, series: SeriesDefinition[]): DaylightPoint[] {
  const first = DateTime.utc(year, 1, 1);
  const days = first.daysInYear ?? 365;

  return Array.from({ length: days }, (_, index) => {
    const date = first.plus({ days: index });
    const point: DaylightPoint = {
      day: index + 1,
      isoDate: date.toISODate()!,
      dateLabel: date.toFormat("MMM d"),
    };

    for (const [placeIndex, place] of places.entries()) {
      const solarTimes = SunCalc.getTimes(date.set({ hour: 12 }).toJSDate(), place.latitude, place.longitude);
      for (const definition of series) {
        if (definition.placeIndex !== placeIndex) continue;
        const solarDate = solarTimes[definition.event];
        point[definition.key] = minuteForScenario(solarDate, place.timezone, year, definition.scenario);
      }
    }
    return point;
  });
}

export function formatMinute(value: number | null | undefined, use24Hour = false): string {
  if (value == null || !Number.isFinite(value)) return "No event";
  const rounded = Math.round(value) % 1440;
  const hour = Math.floor(rounded / 60);
  const minute = rounded % 60;
  if (use24Hour) return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function parseTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function summarizeSeries(points: DaylightPoint[], key: string, mode: "min" | "max") {
  const valid = points.filter((point) => typeof point[key] === "number") as Array<DaylightPoint & Record<string, number>>;
  if (!valid.length) return null;
  return valid.reduce((best, point) => mode === "min" ? (point[key] < best[key] ? point : best) : (point[key] > best[key] ? point : best));
}
