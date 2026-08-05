import { describe, expect, it } from "vitest";
import { buildParams, readSearch, toShareQuery } from "./useSettings";
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
    expect(params.toString()).toBe("c=24");

    const withPlace = buildParams({ ...defaults, places: [chicago] }, false);
    expect(withPlace.getAll("p")).toHaveLength(1);
    expect(withPlace.has("y")).toBe(false);
    expect(withPlace.has("e")).toBe(false);
  });

  it("spells everything out for a shared link", () => {
    const params = buildParams(defaults, true);
    for (const key of ["p", "y", "e", "s"]) {
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
    const restored = readSearch(defaults, toShareQuery(buildParams(chosen, true)));
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
    const restored = readSearch(defaults, "?p=Chicago,IL,41.8781,-87.6298");
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
    const restored = readSearch(stored, "?c=24");
    expect(restored.hiddenSeries).toEqual(["a"]);
    expect(restored.markers).toHaveLength(1);
  });

  it("ignores a query string with nothing of ours in it", () => {
    expect(readSearch(defaults, "?utm_source=x")).toBe(defaults);
    expect(readSearch(defaults, "")).toBe(defaults);
  });

  it("still clamps a year that is out of range", () => {
    expect(readSearch(defaults, "?y=1200").year).toBe(currentYear - 10);
    expect(readSearch(defaults, "?y=9999").year).toBe(currentYear + 10);
  });

  it("keeps a link short and readable", () => {
    const query = toShareQuery(buildParams({ ...defaults, use24Hour: true }, true));
    expect(query).not.toMatch(/%2C|%3A|%7C/);
    expect(query.length).toBeLessThan(80);
  });

  /** Links shared before the short form must still open. */
  it("still reads the long keys, long names and piped places", () => {
    const legacy =
      "?place=city%3AChicago%3AIL%7CChicago%7CIL%7C%7C41.8781%7C-87.6298%7CAmerica%2FChicago" +
      "&year=2027&events=sunrise,sunset,dawn&scenarios=current,permanentStandard" +
      "&marker=morning%7C07%3A30%7CMorning+commute&clock=24";
    const restored = readSearch(defaults, legacy);
    expect(restored.places[0]).toMatchObject({ city: "Chicago", timezone: "America/Chicago" });
    expect(restored.year).toBe(2027);
    expect(restored.events).toEqual(["sunrise", "sunset", "dawn"]);
    expect(restored.scenarios).toEqual(["current", "permanentStandard"]);
    expect(restored.markers[0]).toMatchObject({ time: "07:30", label: "Morning commute", kind: "morning" });
    expect(restored.use24Hour).toBe(true);
  });

  it("derives a place's id and timezone rather than carrying them", () => {
    const [place] = readSearch(defaults, "?p=Chicago,IL,41.8781,-87.6298").places;
    expect(place.timezone).toBe("America/Chicago");
    expect(place.id).toBe("city:Chicago:IL");
    const [zipped] = readSearch(defaults, "?p=Chicago,IL,41.8781,-87.6298,60601").places;
    expect(zipped.id).toBe("zip:60601");
    expect(zipped.zip).toBe("60601");
  });
});
