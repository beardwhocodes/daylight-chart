import type { ResolvedTheme } from "@/hooks/useTheme";
import type { EventType } from "@/types";

/**
 * Chart colors are concrete hex values rather than CSS custom properties.
 * Recharts writes them into SVG presentation attributes, and the PNG export
 * clones the chart into a detached document where `var(--…)` would not resolve.
 * Legend swatches read from the same palette so the two can never drift.
 *
 * Hue carries the solar event — warm for the morning pair, cool for the evening
 * pair — because that is the distinction a reader makes first. Shade within the
 * hue carries the location.
 *
 * Validated with the dataviz palette checker. The pair that is always on screen
 * separates comfortably: slot 0 sunrise against slot 0 sunset scores ΔE 26 under
 * colour-vision deficiency and 30 for normal vision, in both themes. The second
 * location clears the floor too (ΔE 17–23). Slots 3 and 4 are the compromise —
 * four steps inside one hue cannot all separate on these surfaces, so a fourth
 * city leans on the tooltip and the per-line panel, which name every line.
 */
export interface ChartPalette {
  event: {
    /** Morning pair: sunrise and civil dawn. Indexed by place. */
    warm: [string, string, string, string];
    /** Evening pair: sunset and civil dusk. Indexed by place. */
    cool: [string, string, string, string];
  };
  grid: string;
  axis: string;
  cursor: string;
  reference: string;
  referenceLabel: string;
  marker: string;
  /** Halo drawn around the hover dot so it stays readable over a gridline. */
  dotRing: string;
  exportBackground: string;
}

const PALETTES: Record<ResolvedTheme, ChartPalette> = {
  dark: {
    event: {
      warm: ["#fbbf24", "#ea580c", "#fde68a", "#b45309"],
      cool: ["#38bdf8", "#0284c7", "#a5f3fc", "#6366f1"],
    },
    grid: "#ffffff14",
    axis: "#9b9baa",
    cursor: "#ffffff59",
    reference: "#ffffff3d",
    referenceLabel: "#8f8fa0",
    marker: "#e4e4ef",
    dotRing: "#26262e",
    exportBackground: "#1b1b21",
  },
  light: {
    event: {
      warm: ["#d97706", "#9a3412", "#f59e0b", "#78350f"],
      cool: ["#0284c7", "#4338ca", "#0e7490", "#1e3a8a"],
    },
    grid: "#1414191a",
    axis: "#6f6f7d",
    cursor: "#14141966",
    reference: "#14141930",
    referenceLabel: "#7d7d8a",
    marker: "#2c2c36",
    dotRing: "#ffffff",
    exportBackground: "#ffffff",
  },
};

/** Dawn belongs to the morning, dusk to the evening. */
const EVENT_FAMILY: Record<EventType, "warm" | "cool"> = {
  sunrise: "warm",
  dawn: "warm",
  sunset: "cool",
  dusk: "cool",
};

export function chartPalette(theme: ResolvedTheme): ChartPalette {
  return PALETTES[theme];
}

/** The stroke for one line: hue from its event, shade from its place. */
export function seriesColor(palette: ChartPalette, event: EventType, placeIndex: number): string {
  const family = palette.event[EVENT_FAMILY[event]];
  return family[placeIndex % family.length];
}

/**
 * A place's identity in the chrome. Its lines are split across two hues, so a
 * single dot would misrepresent them — the swatch shows both halves.
 */
export function placeSwatch(palette: ChartPalette, placeIndex: number): string {
  const warm = palette.event.warm[placeIndex % 4];
  const cool = palette.event.cool[placeIndex % 4];
  return `linear-gradient(90deg, ${warm} 0 50%, ${cool} 50% 100%)`;
}
