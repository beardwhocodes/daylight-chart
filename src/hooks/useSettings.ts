import { useEffect, useState } from "react";
import { defaultPlace, deserializePlace, serializePlace } from "../lib/locations";
import type { AppSettings, EventType, Scenario, ScheduleMarker } from "../types";

const STORAGE_KEY = "daylight-chart-settings-v1";
const currentYear = new Date().getFullYear();
const validEvents: EventType[] = ["sunrise", "sunset", "dawn", "dusk"];
const validScenarios: Scenario[] = ["current", "permanentDst", "permanentStandard"];

const defaults: AppSettings = {
  places: [defaultPlace],
  year: currentYear,
  events: ["sunrise", "sunset"],
  scenarios: ["current", "permanentDst"],
  hiddenSeries: [],
  markers: [],
  use24Hour: false,
};

function readStored(): AppSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AppSettings> | null;
    if (!parsed) return defaults;
    return {
      ...defaults,
      ...parsed,
      places: parsed.places?.slice(0, 4).filter((place) => place?.id) || defaults.places,
      year: Math.min(currentYear + 10, Math.max(currentYear - 10, parsed.year ?? currentYear)),
    };
  } catch {
    return defaults;
  }
}

function readUrl(base: AppSettings): AppSettings {
  const params = new URLSearchParams(window.location.search);
  if (![...params.keys()].some((key) => ["place", "year", "events", "scenarios", "hidden", "marker", "clock"].includes(key))) {
    return base;
  }
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
    year: Number.isInteger(parsedYear) ? Math.min(currentYear + 10, Math.max(currentYear - 10, parsedYear)) : base.year,
    events: events.length ? events : base.events,
    scenarios: scenarios.length ? scenarios : base.scenarios,
    hiddenSeries: params.getAll("hidden"),
    markers,
    use24Hour: params.get("clock") === "24",
  };
}

function writeUrl(settings: AppSettings) {
  const params = new URLSearchParams();
  settings.places.forEach((place) => params.append("place", serializePlace(place)));
  params.set("year", String(settings.year));
  params.set("events", settings.events.join(","));
  params.set("scenarios", settings.scenarios.join(","));
  settings.hiddenSeries.forEach((key) => params.append("hidden", key));
  settings.markers.forEach((marker) => params.append("marker", `${marker.kind}|${marker.time}|${marker.label}`));
  if (settings.use24Hour) params.set("clock", "24");
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => readUrl(readStored()));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    writeUrl(settings);
  }, [settings]);

  return [settings, setSettings] as const;
}

export const yearOptions = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
