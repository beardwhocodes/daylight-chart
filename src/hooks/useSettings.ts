import { useEffect, useState } from "react";
import { CHART_PARAM } from "../lib/chart-variant";
import { scheduleKindForTime } from "../lib/daylight";
import { decodePlace, defaultPlace, encodePlace } from "../lib/locations";
import type { AppSettings, EventType, Scenario, ScheduleMarker } from "../types";

const STORAGE_KEY = "daylight-chart-settings-v1";
const currentYear = new Date().getFullYear();
/**
 * Short keys, with the long ones kept as aliases so links shared before the
 * change still open. Codes stand in for the long enum names for the same
 * reason a place no longer carries its timezone: the link should hold the
 * choice, not the vocabulary used to store it.
 */
const KEYS = {
  place: ["p", "place"],
  year: ["y", "year"],
  events: ["e", "events"],
  scenarios: ["s", "scenarios"],
  hidden: ["h", "hidden"],
  marker: ["m", "marker"],
  clock: ["c", "clock"],
} as const;
const SETTING_PARAMS = Object.values(KEYS).flat();

const EVENT_CODES: Record<EventType, string> = {
  sunrise: "sr",
  sunset: "ss",
  dawn: "dw",
  dusk: "dk",
};
const SCENARIO_CODES: Record<Scenario, string> = {
  current: "cur",
  permanentDst: "dst",
  permanentStandard: "std",
};
const decodeList = <T extends string>(raw: string | null, codes: Record<T, string>): T[] => {
  const entries = Object.entries(codes) as Array<[T, string]>;
  return (raw?.split(",") ?? [])
    .map((token) => entries.find(([name, code]) => token === code || token === name)?.[0])
    .filter((name): name is T => name !== undefined);
};
const first = (params: URLSearchParams, aliases: readonly string[]) =>
  aliases.map((key) => params.get(key)).find((value) => value !== null) ?? null;
const all = (params: URLSearchParams, aliases: readonly string[]) =>
  aliases.flatMap((key) => params.getAll(key));
const present = (params: URLSearchParams, aliases: readonly string[]) =>
  aliases.some((key) => params.has(key));

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

  const places = all(params, KEYS.place).map(decodePlace).filter((place) => place !== null).slice(0, 4);
  const parsedYear = Number(first(params, KEYS.year));
  const events = decodeList<EventType>(first(params, KEYS.events), EVENT_CODES);
  const scenarios = decodeList<Scenario>(first(params, KEYS.scenarios), SCENARIO_CODES);
  const markers = all(params, KEYS.marker).map((marker, index): ScheduleMarker | null => {
    // `time@label`. Links shared before the short form led with the kind, which
    // is now derived from the time, so an older three-part value drops its head.
    const parts = marker.split(/[@|]/);
    const [time, label] = /^\d{2}:\d{2}$/.test(parts[0]) ? parts : parts.slice(1);
    if (!/^\d{2}:\d{2}$/.test(time ?? "")) return null;
    const kind = scheduleKindForTime(time);
    return {
      id: `url-${index}`,
      kind,
      time,
      label: label || (kind === "morning" ? "Morning schedule" : "Evening schedule"),
    };
  }).filter((marker): marker is ScheduleMarker => marker !== null).slice(0, 2);

  return {
    ...base,
    places: places.length ? places : base.places,
    year: present(params, KEYS.year) && Number.isInteger(parsedYear) ? clampYear(parsedYear) : base.year,
    events: events.length ? events : base.events,
    scenarios: scenarios.length ? scenarios : base.scenarios,
    hiddenSeries: present(params, KEYS.hidden) ? all(params, KEYS.hidden) : base.hiddenSeries,
    markers: present(params, KEYS.marker) ? markers : base.markers,
    use24Hour: present(params, KEYS.clock) ? first(params, KEYS.clock) === "24" : base.use24Hour,
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
  const places = settings.places.map(encodePlace);
  if (explicit || places.join("~") !== defaults.places.map(encodePlace).join("~")) {
    places.forEach((place) => params.append("p", place));
  }
  if (explicit || settings.year !== defaults.year) params.set("y", String(settings.year));
  if (explicit || settings.events.join() !== defaults.events.join()) {
    params.set("e", settings.events.map((event) => EVENT_CODES[event]).join(","));
  }
  if (explicit || settings.scenarios.join() !== defaults.scenarios.join()) {
    params.set("s", settings.scenarios.map((scenario) => SCENARIO_CODES[scenario]).join(","));
  }
  // These three are already absent unless the reader changed something.
  settings.hiddenSeries.forEach((key) => params.append("h", key));
  settings.markers.forEach((marker) => params.append("m", `${marker.time}@${marker.label}`));
  if (settings.use24Hour) params.set("c", "24");
  return params;
}

/**
 * Serialise without escaping what a query string already allows.
 * URLSearchParams percent-encodes commas, colons and spaces, which is legal but
 * turns a readable link into noise. Parsing is unaffected: URLSearchParams
 * reads these back as written, and `+` as a space.
 */
export function toShareQuery(params: URLSearchParams): string {
  const parts: string[] = [];
  params.forEach((value, key) => {
    const encoded = encodeURIComponent(value)
      .replace(/%2C/g, ",")
      .replace(/%3A/g, ":")
      .replace(/%40/g, "@")
      .replace(/%20/g, "+");
    parts.push(`${key}=${encoded}`);
  });
  return parts.join("&");
}

/** A link that spells out the whole view, for sharing. */
export function shareUrl(settings: AppSettings): string {
  const params = buildParams(settings, true);
  const chart = new URLSearchParams(window.location.search).get(CHART_PARAM);
  if (chart) params.set(CHART_PARAM, chart);
  return `${window.location.origin}${window.location.pathname}?${toShareQuery(params)}${window.location.hash}`;
}

function writeUrl(settings: AppSettings) {
  const params = buildParams(settings, false);
  // The chart variant is a view toggle rather than a setting, so it is not part
  // of AppSettings — but it does live in the query string, and this rewrite
  // replaces the whole string. Carry it over or it is lost on first render.
  const chart = new URLSearchParams(window.location.search).get(CHART_PARAM);
  if (chart) params.set(CHART_PARAM, chart);
  const query = toShareQuery(params);
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
