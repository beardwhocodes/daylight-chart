import { describe, expect, it } from "vitest";
import { buildSeries, calculateYear, seriesKey } from "./daylight";
import SunCalc from "suncalc";
import { HORIZON_DEG, maxAnnualAltitude, moonAt, moonTrack, scenarioShift, sunAltitude } from "./sun-path";
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

  it("reports every hour the moon is above the horizon, daylight included", () => {
    const track = moonTrack(chicago, "2026-12-24", 2026, "current");
    expect(track.length).toBeGreaterThan(0);
    for (const sample of track) {
      expect(sample.altitude).toBeGreaterThan(0);
      expect(sample.clockMinute % 60).toBe(0);
    }
    // A full moon is up all night, so its track must span more than a few hours.
    expect(track.length).toBeGreaterThan(8);
  });

  it("leaves the moon out only when it never clears the horizon", () => {
    for (let i = 1; i <= 28; i += 1) {
      const isoDate = `2026-06-${String(i).padStart(2, "0")}`;
      const track = moonTrack(chicago, isoDate, 2026, "current");
      const anyUp = Array.from({ length: 24 }, (_, hour) =>
        moonAt(chicago, isoDate, 2026, "current", hour * 60).altitude,
      ).some((altitude) => altitude > 0);
      expect(track.length > 0).toBe(anyUp);
    }
  });

  /**
   * The lit edge of the moon always faces the sun. Rather than trust SunCalc's
   * angle conventions, rebuild the direction to the sun from altitude and
   * azimuth alone and check the rotation we draw with agrees.
   */
  it("points the lit edge at the sun", () => {
    const toUnit = (altitude: number, azimuthFromSouth: number) => {
      const a = azimuthFromSouth + Math.PI;
      return [Math.cos(altitude) * Math.cos(a), Math.cos(altitude) * Math.sin(a), Math.sin(altitude)];
    };
    const norm = (angle: number) => {
      let value = angle;
      while (value > 180) value -= 360;
      while (value < -180) value += 360;
      return value;
    };

    let checked = 0;
    for (let day = 0; day < 60; day += 3) {
      // Built from a UTC midnight so the day rolls into February correctly, and
      // read back as an ISO date the UTC-zoned lookup will reproduce exactly.
      const midnight = new Date(Date.UTC(2026, 0, 1 + day));
      const isoDate = midnight.toISOString().slice(0, 10);
      for (const hour of [0, 4, 18, 21]) {
        const at = new Date(midnight.getTime() + hour * 3600000);
        const moon = SunCalc.getMoonPosition(at, chicago.latitude, chicago.longitude);
        const illumination = SunCalc.getMoonIllumination(at);
        // A limb angle is meaningless at new and full, where there is no crescent.
        if (moon.altitude <= 0 || illumination.fraction < 0.05 || illumination.fraction > 0.95) continue;

        const sun = SunCalc.getPosition(at, chicago.latitude, chicago.longitude);
        const azimuth = moon.azimuth + Math.PI;
        const m = toUnit(moon.altitude, moon.azimuth);
        const s = toUnit(sun.altitude, sun.azimuth);
        const up = [
          -Math.sin(moon.altitude) * Math.cos(azimuth),
          -Math.sin(moon.altitude) * Math.sin(azimuth),
          Math.cos(moon.altitude),
        ];
        const east = [-Math.sin(azimuth), Math.cos(azimuth), 0];
        const dot = m[0] * s[0] + m[1] * s[1] + m[2] * s[2];
        const toSun = s.map((value, index) => value - dot * m[index]);
        const alongUp = toSun[0] * up[0] + toSun[1] * up[1] + toSun[2] * up[2];
        const alongEast = toSun[0] * east[0] + toSun[1] * east[1] + toSun[2] * east[2];
        // Zenith angle of the sun as seen from the moon, anticlockwise from up.
        const zenith = (Math.atan2(-alongEast, alongUp) * 180) / Math.PI;

        // The glyph is drawn with its limb toward +x, ninety degrees clockwise
        // of up, so the rotation we apply must land the limb on that angle.
        const drawn = moonAt({ ...chicago, timezone: "UTC" }, isoDate, 2026, "current", hour * 60);
        expect(Math.abs(norm(drawn.limbRotation - (-zenith - 90)))).toBeLessThan(1);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

});
