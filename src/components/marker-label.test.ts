import { describe, expect, it } from "vitest";
import { clearestFraction } from "./DaylightChart";
import { buildSeries, calculateYear, parseTime } from "@/lib/daylight";
import type { Place } from "@/types";

const washington: Place = {
  id: "dc",
  city: "Washington",
  state: "DC",
  latitude: 38.9072,
  longitude: -77.0369,
  timezone: "America/New_York",
};

const series = buildSeries([washington], ["sunrise", "sunset"], ["current", "permanentDst"]);
const points = calculateYear([washington], 2026, series);

/** Smallest distance from the marker to any line at that day, in minutes. */
function gapAt(fraction: number, markerMinute: number) {
  const point = points[Math.round(fraction * (points.length - 1))];
  return Math.min(
    ...series.map((definition) => Math.abs((point[definition.key] as number) - markerMinute)),
  );
}

describe("schedule label placement", () => {
  it("puts the label where the lines are furthest away", () => {
    for (const time of ["06:00", "07:30", "17:30", "19:00"]) {
      const minute = parseTime(time);
      const chosen = clearestFraction(points, series, minute);
      // Beats the middle and both thirds, which is what a fixed position would use.
      for (const fixed of [0.25, 0.5, 0.75]) {
        expect(gapAt(chosen, minute)).toBeGreaterThanOrEqual(gapAt(fixed, minute));
      }
    }
  });

  it("leaves room at both ends so the label stays inside the plot", () => {
    for (const time of ["06:00", "07:30", "17:30", "19:00"]) {
      const fraction = clearestFraction(points, series, parseTime(time));
      expect(fraction).toBeGreaterThan(0.1);
      expect(fraction).toBeLessThan(0.9);
    }
  });

  it("falls back to the middle when there is nothing to avoid", () => {
    expect(clearestFraction([], [], 450)).toBe(0.5);
  });
});
