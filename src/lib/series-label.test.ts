import { describe, expect, it } from "vitest";
import { buildSeries } from "./daylight";
import type { Place } from "../types";

const washington: Place = {
  id: "dc",
  city: "Washington",
  state: "DC",
  latitude: 38.9072,
  longitude: -77.0369,
  timezone: "America/New_York",
};
const chicago: Place = {
  id: "chi",
  city: "Chicago",
  state: "IL",
  latitude: 41.8781,
  longitude: -87.6298,
  timezone: "America/Chicago",
};

describe("series labels", () => {
  it("leaves the city out when there is only one", () => {
    const [first] = buildSeries([washington], ["sunrise"], ["current"]);
    expect(first.label).toBe("Sunrise — Current law");
  });

  it("names the city once there is more than one to tell apart", () => {
    const series = buildSeries([washington, chicago], ["sunset"], ["permanentDst"]);
    expect(series.map((definition) => definition.label)).toEqual([
      "Washington Sunset — Permanent DST",
      "Chicago Sunset — Permanent DST",
    ]);
  });

  it("keys stay place-scoped either way, so lines never collide", () => {
    const one = buildSeries([washington], ["sunrise"], ["current"])[0];
    const two = buildSeries([washington, chicago], ["sunrise"], ["current"]);
    expect(one.key).toBe(two[0].key);
    expect(two[0].key).not.toBe(two[1].key);
  });
});
