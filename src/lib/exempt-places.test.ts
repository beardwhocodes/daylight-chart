import { describe, expect, it } from "vitest";
import { buildSeries, calculateYear, exemptPlaces, seriesKey } from "./daylight";
import type { Place } from "../types";

const place = (id: string, city: string, state: string, latitude: number, longitude: number, timezone: string): Place =>
  ({ id, city, state, latitude, longitude, timezone });

const phoenix = place("phx", "Phoenix", "AZ", 33.4484, -112.074, "America/Phoenix");
const honolulu = place("hnl", "Honolulu", "HI", 21.3069, -157.8583, "Pacific/Honolulu");
const sanJuan = place("sju", "San Juan", "PR", 18.4655, -66.1057, "America/Puerto_Rico");
const washington = place("dc", "Washington", "DC", 38.9072, -77.0369, "America/New_York");
// The Navajo Nation observes DST inside Arizona, which does not. tz-lookup puts
// these towns in America/Denver, so they must be treated as clock-changing.
const windowRock = place("wr", "Window Rock", "AZ", 35.6811, -109.0537, "America/Denver");

describe("clock-change exemption", () => {
  it("names the jurisdictions that never move their clocks", () => {
    expect(exemptPlaces([phoenix, honolulu, sanJuan], 2026).map((p) => p.city)).toEqual([
      "Phoenix",
      "Honolulu",
      "San Juan",
    ]);
  });

  it("leaves clock-changing places out, including the Navajo Nation inside Arizona", () => {
    expect(exemptPlaces([washington, windowRock], 2026)).toEqual([]);
    expect(exemptPlaces([phoenix, windowRock], 2026).map((p) => p.city)).toEqual(["Phoenix"]);
  });

  /**
   * The reason the notice exists: for an exempt place the two scenario lines
   * carry identical values, so the chart shows one line where the legend
   * promises two. If this ever stops being true the notice is wrong.
   */
  it("is exactly the case where the proposed line equals the current one", () => {
    for (const subject of [phoenix, honolulu, sanJuan]) {
      const series = buildSeries([subject], ["sunrise", "sunset"], ["current", "permanentDst"]);
      const points = calculateYear([subject], 2026, series);
      expect(exemptPlaces([subject], 2026)).toHaveLength(1);
      for (const point of points) {
        expect(point[seriesKey(subject.id, "sunrise", "permanentDst")]).toBe(
          point[seriesKey(subject.id, "sunrise", "current")],
        );
      }
    }
  });

  it("does move the proposed line for a place that changes clocks", () => {
    const series = buildSeries([washington], ["sunrise"], ["current", "permanentDst"]);
    const points = calculateYear([washington], 2026, series);
    const january = points[14];
    expect(
      (january[seriesKey(washington.id, "sunrise", "permanentDst")] as number) -
        (january[seriesKey(washington.id, "sunrise", "current")] as number),
    ).toBeCloseTo(60, 5);
  });
});
