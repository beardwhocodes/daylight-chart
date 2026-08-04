import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { buildSeries, calculateYear, formatMinute, minuteForScenario, scenarioOffsets, seriesKey } from "./daylight";

describe("daylight policy calculations", () => {
  it("detects DST-observing and exempt time zones", () => {
    expect(scenarioOffsets("America/New_York", 2026).observesDst).toBe(true);
    expect(scenarioOffsets("America/Phoenix", 2026).observesDst).toBe(false);
    expect(scenarioOffsets("Pacific/Honolulu", 2026).observesDst).toBe(false);
  });

  it("moves winter events one hour later under permanent DST", () => {
    const sunrise = DateTime.fromISO("2026-01-15T07:24:00", { zone: "America/New_York" }).toJSDate();
    expect(minuteForScenario(sunrise, "America/New_York", 2026, "current")).toBe(444);
    expect(minuteForScenario(sunrise, "America/New_York", 2026, "permanentDst")).toBe(504);
  });

  it("leaves exempt jurisdictions unchanged under permanent DST", () => {
    const sunrise = DateTime.fromISO("2026-01-15T07:30:00", { zone: "America/Phoenix" }).toJSDate();
    expect(minuteForScenario(sunrise, "America/Phoenix", 2026, "permanentDst")).toBe(450);
  });

  it("moves summer events one hour earlier under permanent standard time", () => {
    const sunset = DateTime.fromISO("2026-07-15T20:30:00", { zone: "America/New_York" }).toJSDate();
    expect(minuteForScenario(sunset, "America/New_York", 2026, "permanentStandard")).toBe(1170);
  });

  it("formats local clock times", () => {
    expect(formatMinute(0)).toBe("12:00 AM");
    expect(formatMinute(13 * 60 + 5)).toBe("1:05 PM");
    expect(formatMinute(13 * 60 + 5, true)).toBe("13:05");
  });

  it("applies the proposed shift only outside the current DST season", () => {
    const place = { id: "dc", city: "Washington", state: "DC", latitude: 38.9072, longitude: -77.0369, timezone: "America/New_York" };
    const series = buildSeries([place], ["sunrise"], ["current", "permanentDst"]);
    const points = calculateYear([place], 2026, series);
    const currentKey = seriesKey(place.id, "sunrise", "current");
    const proposedKey = seriesKey(place.id, "sunrise", "permanentDst");
    expect(Math.round((points[14][proposedKey] as number) - (points[14][currentKey] as number))).toBe(60);
    expect(Math.round((points[195][proposedKey] as number) - (points[195][currentKey] as number))).toBe(0);
  });

  it("keeps Arizona unchanged in the full-year proposed scenario", () => {
    const place = { id: "phx", city: "Phoenix", state: "AZ", latitude: 33.4484, longitude: -112.074, timezone: "America/Phoenix" };
    const series = buildSeries([place], ["sunrise", "sunset"], ["current", "permanentDst"]);
    const points = calculateYear([place], 2026, series);
    for (const point of points) {
      expect(point[seriesKey(place.id, "sunrise", "permanentDst")]).toBe(point[seriesKey(place.id, "sunrise", "current")]);
      expect(point[seriesKey(place.id, "sunset", "permanentDst")]).toBe(point[seriesKey(place.id, "sunset", "current")]);
    }
  });
});
