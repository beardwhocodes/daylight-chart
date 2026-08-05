import { describe, expect, it } from "vitest";
import { buildParams, readSearch } from "./useSettings";
import { defaultPlace } from "@/lib/locations";
import type { AppSettings, Place } from "@/types";

const currentYear = new Date().getFullYear();
const chicago: Place = {
  id: "city:Chicago:IL",
  city: "Chicago",
  state: "IL",
  latitude: 41.8781,
  longitude: -87.6298,
  timezone: "America/Chicago",
};

const defaults: AppSettings = {
  places: [defaultPlace],
  year: currentYear,
  events: ["sunrise", "sunset"],
  scenarios: ["current", "permanentDst"],
  hiddenSeries: [],
  markers: [],
  use24Hour: false,
};

describe("settings in the address bar", () => {
  it("writes nothing when nothing has been changed", () => {
    expect(buildParams(defaults, false).toString()).toBe("");
  });

  it("writes only what was changed", () => {
    const params = buildParams({ ...defaults, use24Hour: true }, false);
    expect(params.toString()).toBe("clock=24");

    const withPlace = buildParams({ ...defaults, places: [chicago] }, false);
    expect(withPlace.getAll("place")).toHaveLength(1);
    expect(withPlace.has("year")).toBe(false);
    expect(withPlace.has("events")).toBe(false);
  });

  it("spells everything out for a shared link", () => {
    const params = buildParams(defaults, true);
    for (const key of ["place", "year", "events", "scenarios"]) {
      expect(params.has(key)).toBe(true);
    }
  });

  it("round-trips a shared link back to the same settings", () => {
    const chosen: AppSettings = {
      places: [chicago],
      year: currentYear + 1,
      events: ["sunrise", "sunset", "dawn", "dusk"],
      scenarios: ["current", "permanentStandard"],
      hiddenSeries: ["city:Chicago:IL|dawn|current"],
      markers: [{ id: "m", kind: "morning", time: "07:30", label: "Morning commute" }],
      use24Hour: true,
    };
    const restored = readSearch(defaults, buildParams(chosen, true).toString());
    expect(restored.places.map((place) => place.id)).toEqual(["city:Chicago:IL"]);
    expect(restored.year).toBe(chosen.year);
    expect(restored.events).toEqual(chosen.events);
    expect(restored.scenarios).toEqual(chosen.scenarios);
    expect(restored.hiddenSeries).toEqual(chosen.hiddenSeries);
    expect(restored.use24Hour).toBe(true);
    expect(restored.markers.map((marker) => marker.time)).toEqual(["07:30"]);
  });

  /**
   * The bug this guards: `Number(null)` is 0 and `Number.isInteger(0)` is true,
   * so a link that names a place but no year used to clamp the year to a decade
   * ago instead of leaving it alone.
   */
  it("leaves the year alone when a link does not name one", () => {
    const restored = readSearch(defaults, "?place=city%3AChicago%3AIL%7CChicago%7CIL%7C%7C41.8781%7C-87.6298%7CAmerica%2FChicago");
    expect(restored.year).toBe(currentYear);
    expect(restored.places[0].city).toBe("Chicago");
  });

  it("leaves other unnamed settings alone too", () => {
    const stored: AppSettings = {
      ...defaults,
      use24Hour: true,
      hiddenSeries: ["a"],
      markers: [{ id: "m", kind: "evening", time: "17:30", label: "Home" }],
    };
    const restored = readSearch(stored, "?clock=24");
    expect(restored.hiddenSeries).toEqual(["a"]);
    expect(restored.markers).toHaveLength(1);
  });

  it("ignores a query string with nothing of ours in it", () => {
    expect(readSearch(defaults, "?utm_source=x")).toBe(defaults);
    expect(readSearch(defaults, "")).toBe(defaults);
  });

  it("still clamps a year that is out of range", () => {
    expect(readSearch(defaults, "?year=1200").year).toBe(currentYear - 10);
    expect(readSearch(defaults, "?year=9999").year).toBe(currentYear + 10);
  });
});
