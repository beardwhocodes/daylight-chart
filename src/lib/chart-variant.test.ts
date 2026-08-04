import { describe, expect, it } from "vitest";
import { readChartView } from "./chart-variant";

describe("chart variant routing", () => {
  it("defaults to the year chart", () => {
    expect(readChartView({ pathname: "/", search: "" })).toEqual({ variant: "classic", compare: false });
  });

  it("selects the sun path from the query string", () => {
    expect(readChartView({ pathname: "/", search: "?chart=sunpath" })).toEqual({
      variant: "sunpath",
      compare: false,
    });
  });

  it("stacks both on the compare path, with or without a trailing slash", () => {
    for (const pathname of ["/compare", "/compare/", "/Compare"]) {
      expect(readChartView({ pathname, search: "" }).compare).toBe(true);
    }
  });

  it("ignores an unknown variant rather than rendering nothing", () => {
    expect(readChartView({ pathname: "/", search: "?chart=nope" }).variant).toBe("classic");
  });

  it("keeps working alongside the settings the app already puts in the URL", () => {
    const view = readChartView({ pathname: "/", search: "?place=chi&year=2026&chart=sunpath&clock=24" });
    expect(view.variant).toBe("sunpath");
  });
});
