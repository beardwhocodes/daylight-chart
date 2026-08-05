import { useEffect, useState } from "react";
import { CHART_PARAM } from "../lib/chart-variant";
import { defaultPlace, deserializePlace, serializePlace } from "../lib/locations";
import type { AppSettings, EventType, Scenario, ScheduleMarker } from "../types";

const STORAGE_KEY = "daylight-chart-settings-v1";
const currentYear = new Date().getFullYear();
const validEvents: EventType[] = ["sunrise", "sunset", "dawn", "dusk"];
const validScenarios: Scenario[] = ["current", "permanentDst", "permanentStandard"];
const SETTING_PARAMS = ["place", "year", "events", "scenarios", "hidden", "marker", "clock"];

const defaults: AppSettings = {
  places: [defaultPlace],
  year: currentYear,
  events: ["sunrise", "sunset"],
  scenarios: ["current", "permanentDst"],
  hiddenSeries: [],
  markers: [],
  use24Hour: false,
};

const clampYear = (year: number) =>
  Math.min(currentYear + 10, Math.max(currentYear - 10, year));

function readStored(): AppSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AppSettings> | null;
    if (!parsed) return defaults;
    return {
      ...defaults,
      ...parsed,
      places: parsed.places?.slice(0, 4).filter((place) => place?.id) || defaults.places,
      year: clampYear(parsed.year ?? currentYear),
    };
  } catch {
    return defaults;
  }
}

/**
 * Settings named in the query string win; everything else is left as it was.
 *
 * Each field checks that its parameter is present rather than reading a missing
 * one and trusting the result. `Number(null)` is 0, and 0 is an integer, so a
 * link without `year` used to clamp the year to a decade ago.
 */
export function readSearch(base: AppSettings, search: string): AppSettings {
  const params = new URLSearchParams(search);
  if (!SETTING_PARAMS.some((key) => params.has(key))) return base;

  const places = params.getAll("place").map(deserializePlace).filter((place) => place !== null).slice(0, 4);
  const parsedYear = Number(params.get("year"));
  const events = (params.get("events")?.split(",") ?? []).filter((event): event is EventType => validEvents.includes(event as EventType));
  const scenarios = (params.get("scenarios")?.split(",") ?? []).filter((scenario): scenario is Scenario => validScenarios.includes(scenario as Scenario));
  const markers = params.getAll("marker").map((marker, index): ScheduleMarker | null => {
    const [kind, time, label] = marker.split("|");
    if ((kind !== "morning" && kind !== "evening") || !/^\d{2}:\d{2}$/.test(time)) return null;
    return { id: `url-${index}`, kind, time, label: label || (kind === "morning" ? "Morning schedule" : "Evening schedule") };
  }).filter((marker): marker is ScheduleMarker => marker !== null).slice(0, 2);

  return {
    ...base,
    places: places.length ? places : base.places,
    year: params.has("year") && Number.isInteger(parsedYear) ? clampYear(parsedYear) : base.year,
    events: events.length ? events : base.events,
    scenarios: scenarios.length ? scenarios : base.scenarios,
    hiddenSeries: params.has("hidden") ? params.getAll("hidden") : base.hiddenSeries,
    markers: params.has("marker") ? markers : base.markers,
    use24Hour: params.has("clock") ? params.get("clock") === "24" : base.use24Hour,
  };
}

/**
 * Settings as query parameters.
 *
 * The address bar carries only what the reader has actually changed, so
 * arriving at the bare domain leaves a bare domain rather than a hundred
 * characters of defaults. A shared link is written in full instead, so it keeps
 * meaning the same thing even if the defaults here change later.
 */
export function buildParams(settings: AppSettings, explicit: boolean): URLSearchParams {
  const params = new URLSearchParams();
  const places = settings.places.map(serializePlace);
  if (explicit || places.join("~") !== defaults.places.map(serializePlace).join("~")) {
    places.forEach((place) => params.append("place", place));
  }
  if (explicit || settings.year !== defaults.year) params.set("year", String(settings.year));
  if (explicit || settings.events.join() !== defaults.events.join()) {
    params.set("events", settings.events.join(","));
  }
  if (explicit || settings.scenarios.join() !== defaults.scenarios.join()) {
    params.set("scenarios", settings.scenarios.join(","));
  }
  // These three are already absent unless the reader changed something.
  settings.hiddenSeries.forEach((key) => params.append("hidden", key));
  settings.markers.forEach((marker) => params.append("marker", `${marker.kind}|${marker.time}|${marker.label}`));
  if (settings.use24Hour) params.set("clock", "24");
  return params;
}

/** A link that spells out the whole view, for sharing. */
export function shareUrl(settings: AppSettings): string {
  const params = buildParams(settings, true);
  const chart = new URLSearchParams(window.location.search).get(CHART_PARAM);
  if (chart) params.set(CHART_PARAM, chart);
  return `${window.location.origin}${window.location.pathname}?${params}${window.location.hash}`;
}

function writeUrl(settings: AppSettings) {
  const params = buildParams(settings, false);
  // The chart variant is a view toggle rather than a setting, so it is not part
  // of AppSettings — but it does live in the query string, and this rewrite
  // replaces the whole string. Carry it over or it is lost on first render.
  const chart = new URLSearchParams(window.location.search).get(CHART_PARAM);
  if (chart) params.set(CHART_PARAM, chart);
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() =>
    readSearch(readStored(), window.location.search),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    writeUrl(settings);
  }, [settings]);

  return [settings, setSettings] as const;
}

export const yearOptions = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
