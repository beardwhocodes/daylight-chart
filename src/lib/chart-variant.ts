/**
 * Which chart the page renders. This is a view toggle for comparing designs,
 * not a user preference, so it is read from the URL and never persisted.
 *
 *   /                 the year chart
 *   /?chart=sunpath   the single-day sun path
 *   /compare          both, stacked, sharing one set of settings
 *
 * `/compare` relies on the Worker's single-page-application not-found handling,
 * which serves index.html for any path.
 *
 * TODO: delete this module once one chart wins. Both are carried in the bundle
 * only so they can be compared, and shipping two answers to the same question
 * is worse than shipping either one. Removing it means:
 *   - drop the losing chart component and its lib module
 *   - drop the `chartView` branches and `VariantHeading` in App.tsx
 *   - drop the CHART_PARAM carry-over in useSettings.writeUrl
 *   - drop this file and chart-variant.test.ts
 */
export type ChartVariant = "classic" | "sunpath";

export interface ChartView {
  variant: ChartVariant;
  compare: boolean;
}

export const CHART_PARAM = "chart";
export const COMPARE_PATH = "/compare";

const VARIANTS: ChartVariant[] = ["classic", "sunpath"];

export function readChartView(location: { pathname: string; search: string }): ChartView {
  if (location.pathname.replace(/\/+$/, "").toLowerCase() === COMPARE_PATH) {
    return { variant: "classic", compare: true };
  }
  const requested = new URLSearchParams(location.search).get(CHART_PARAM);
  return { variant: VARIANTS.find((name) => name === requested) ?? "classic", compare: false };
}
