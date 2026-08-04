import type { ResolvedTheme } from "@/hooks/useTheme";

/**
 * Chart colors are concrete hex values rather than CSS custom properties.
 * Recharts writes them into SVG presentation attributes, and the PNG export
 * clones the chart into a detached document where `var(--…)` would not resolve.
 * Legend swatches read from the same palette so the two can never drift.
 */
export interface ChartPalette {
  series: [string, string, string, string];
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
    series: ["#fbbf24", "#38bdf8", "#a78bfa", "#34d399"],
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
    series: ["#d97706", "#0284c7", "#7c3aed", "#059669"],
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

export function chartPalette(theme: ResolvedTheme): ChartPalette {
  return PALETTES[theme];
}
