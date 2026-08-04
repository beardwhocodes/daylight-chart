import { describe, expect, it } from "vitest";
import { chartPalette, placeSwatch, seriesColor } from "./chart-theme";

describe("chart palette", () => {
  it("gives the morning pair a warm hue and the evening pair a cool one", () => {
    for (const theme of ["dark", "light"] as const) {
      const palette = chartPalette(theme);
      // Dawn rides with sunrise and dusk with sunset, so a twilight line never
      // reads as belonging to the opposite end of the day.
      expect(seriesColor(palette, "sunrise", 0)).toBe(palette.event.warm[0]);
      expect(seriesColor(palette, "dawn", 0)).toBe(palette.event.warm[0]);
      expect(seriesColor(palette, "sunset", 0)).toBe(palette.event.cool[0]);
      expect(seriesColor(palette, "dusk", 0)).toBe(palette.event.cool[0]);
    }
  });

  it("keeps the same event in one hue while the place changes the shade", () => {
    const palette = chartPalette("dark");
    const sunrises = [0, 1, 2, 3].map((index) => seriesColor(palette, "sunrise", index));
    expect(new Set(sunrises).size).toBe(4);
    expect(sunrises).toEqual(palette.event.warm);
    expect(seriesColor(palette, "sunset", 1)).toBe(palette.event.cool[1]);
  });

  it("never hands back undefined for a place beyond the palette", () => {
    const palette = chartPalette("dark");
    // The app caps places at four, but the lookup must not produce an undefined
    // stroke if that cap ever moves — an undefined stroke renders as black.
    expect(seriesColor(palette, "sunrise", 4)).toBe(palette.event.warm[0]);
    expect(seriesColor(palette, "sunset", 9)).toBe(palette.event.cool[1]);
  });

  it("shows both halves of a place's pair in its chip", () => {
    const palette = chartPalette("dark");
    const swatch = placeSwatch(palette, 0);
    expect(swatch).toContain(palette.event.warm[0]);
    expect(swatch).toContain(palette.event.cool[0]);
  });
});
