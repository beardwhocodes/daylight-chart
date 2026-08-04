import { describe, expect, it } from "vitest";
import { buildSeries, calculateYear, seriesKey } from "./daylight";
import { HORIZON_DEG, maxAnnualAltitude, moonHighlight, scenarioShift, sunAltitude } from "./sun-path";
import type { Place } from "../types";

const chicago: Place = {
  id: "chi",
  city: "Chicago",
  state: "IL",
  latitude: 41.8781,
  longitude: -87.6298,
  timezone: "America/Chicago",
};
const phoenix: Place = {
  id: "phx",
  city: "Phoenix",
  state: "AZ",
  latitude: 33.4484,
  longitude: -112.074,
  timezone: "America/Phoenix",
};

describe("sun path geometry", () => {
  /**
   * The load-bearing test: the altitude curve must cross the horizon at exactly
   * the sunrise and sunset the rest of the app already plots. If these two ever
   * disagree, the panel draws a sun that rises at the wrong time.
   */
  it("puts the sun on the horizon at the sunrise and sunset the chart plots", () => {
    const series = buildSeries([chicago], ["sunrise", "sunset"], ["current", "permanentDst"]);
    const points = calculateYear([chicago], 2026, series);

    for (const dayIndex of [0, 79, 171, 264, 354]) {
      const point = points[dayIndex];
      for (const scenario of ["current", "permanentDst"] as const) {
        for (const event of ["sunrise", "sunset"] as const) {
          const minute = point[seriesKey(chicago.id, event, scenario)] as number;
          const altitude = sunAltitude(chicago, point.isoDate, 2026, scenario, minute);
          // SunCalc's getTimes solves for the horizon approximately, so it
          // disagrees with its own getPosition by up to 0.3 degrees — about
          // 1.5 minutes of clock. Anything wrong with the scenario shift would
          // land an hour out, roughly 10 degrees, so this still catches it.
          expect(Math.abs(altitude - HORIZON_DEG)).toBeLessThan(0.5);
        }
      }
    }
  });

  it("climbs above the horizon between sunrise and sunset and drops below outside", () => {
    const series = buildSeries([chicago], ["sunrise", "sunset"], ["current"]);
    const point = calculateYear([chicago], 2026, series)[171];
    const sunrise = point[seriesKey(chicago.id, "sunrise", "current")] as number;
    const sunset = point[seriesKey(chicago.id, "sunset", "current")] as number;

    expect(sunAltitude(chicago, point.isoDate, 2026, "current", (sunrise + sunset) / 2)).toBeGreaterThan(60);
    expect(sunAltitude(chicago, point.isoDate, 2026, "current", sunrise - 30)).toBeLessThan(HORIZON_DEG);
    expect(sunAltitude(chicago, point.isoDate, 2026, "current", sunset + 30)).toBeLessThan(HORIZON_DEG);
  });

  it("shifts the clock only outside the current DST season", () => {
    expect(scenarioShift(chicago, "2026-01-15", 2026, "current")).toBe(0);
    expect(scenarioShift(chicago, "2026-01-15", 2026, "permanentDst")).toBe(60);
    expect(scenarioShift(chicago, "2026-07-15", 2026, "permanentDst")).toBe(0);
    expect(scenarioShift(chicago, "2026-07-15", 2026, "permanentStandard")).toBe(-60);
    expect(scenarioShift(chicago, "2026-01-15", 2026, "permanentStandard")).toBe(0);
  });

  it("leaves exempt jurisdictions on one clock all year", () => {
    for (const isoDate of ["2026-01-15", "2026-07-15"]) {
      expect(scenarioShift(phoenix, isoDate, 2026, "permanentDst")).toBe(0);
      expect(scenarioShift(phoenix, isoDate, 2026, "permanentStandard")).toBe(0);
    }
  });

  it("caps the annual sun height at the latitude, and at the zenith in the tropics", () => {
    expect(maxAnnualAltitude(41.8781)).toBeCloseTo(71.56, 1);
    expect(maxAnnualAltitude(-33.87)).toBeCloseTo(79.57, 1);
    expect(maxAnnualAltitude(10)).toBe(90);
  });

  it("only ever reports a moon that is up in a dark sky", () => {
    // The invariant, checked across a full lunar month. Whether any given night
    // yields null is a coincidence of the orbit, so assert the contract instead:
    // a result must always be visible, and null is a legal answer.
    for (let i = 1; i <= 30; i += 1) {
      const isoDate = `2026-06-${String(i).padStart(2, "0")}`;
      const highlight = moonHighlight(chicago, isoDate, 2026, "current");
      if (!highlight) continue;
      expect(highlight.altitude).toBeGreaterThan(0);
      expect(sunAltitude(chicago, isoDate, 2026, "current", highlight.clockMinute)).toBeLessThan(-6);
    }
  });

  it("places the moon above the horizon in darkness when it reports one", () => {
    const highlight = moonHighlight(chicago, "2026-12-24", 2026, "current");
    expect(highlight).not.toBeNull();
    expect(highlight!.altitude).toBeGreaterThan(0);
    expect(highlight!.fraction).toBeGreaterThan(0.9);
    expect(sunAltitude(chicago, "2026-12-24", 2026, "current", highlight!.clockMinute)).toBeLessThan(-6);
  });
});
