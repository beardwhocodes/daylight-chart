import { toPng } from "html-to-image";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Download,
  FileDown,
  Image as ImageIcon,
  Info,
  Link2,
  MoonStar,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClockShiftDiagram } from "@/components/ClockShiftDiagram";
import { DailyTable } from "@/components/DailyTable";
import { DaylightChart } from "@/components/DaylightChart";
import { LocationSearch } from "@/components/LocationSearch";
import { SchedulePanel } from "@/components/SchedulePanel";
import { SeriesControls, SeriesSwatch } from "@/components/SeriesControls";
import { SunPathPanel } from "@/components/SunPathPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldLabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSettings, yearOptions } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { chartPalette, placeSwatch } from "@/lib/chart-theme";
import { CHART_PARAM, readChartView, type ChartVariant } from "@/lib/chart-variant";
import {
  buildSeries,
  calculateYear,
  formatMinute,
  parseTime,
  scenarioOffsets,
  seriesKey,
  summarizeSeries,
} from "@/lib/daylight";
import { placeLabel } from "@/lib/locations";
import type { EventType, Scenario } from "@/types";

const SCENARIO_OPTIONS: Array<{ value: Scenario; label: string }> = [
  { value: "current", label: "Current law" },
  { value: "permanentDst", label: "Permanent DST" },
  { value: "permanentStandard", label: "Permanent standard" },
];

const EVENT_OPTIONS: Array<{ value: EventType; label: string; icon: typeof Sunrise }> = [
  { value: "sunrise", label: "Sunrise", icon: Sunrise },
  { value: "sunset", label: "Sunset", icon: Sunset },
];

const TWILIGHT_EVENTS: EventType[] = ["dawn", "dusk"];

const CHART_VIEW_OPTIONS: Array<{ value: ChartVariant; label: string; icon: typeof CalendarDays }> = [
  { value: "classic", label: "Year", icon: CalendarDays },
  { value: "sunpath", label: "One day", icon: Sunrise },
];

/** Labels each chart on /compare, where two of them share one card. */
function VariantHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-[0.12em] uppercase">
      {children}
    </div>
  );
}

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function csvCell(value: string | number) {
  const string = String(value);
  return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function SectionHeading({
  index,
  eyebrow,
  title,
  invert,
}: {
  index: string;
  eyebrow: string;
  title: string;
  invert?: boolean;
}) {
  return (
    <div className="mb-12 max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={
            invert
              ? "tabular text-[11px] font-semibold tracking-[0.16em] text-white/40"
              : "tabular text-muted-foreground/60 text-[11px] font-semibold tracking-[0.16em]"
          }
        >
          {index}
        </span>
        <span className={invert ? "h-px w-8 bg-white/20" : "bg-border h-px w-8"} />
        <span className="text-sun text-[11px] font-semibold tracking-[0.12em] uppercase">
          {eyebrow}
        </span>
      </div>
      <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
        {title}
      </h2>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-card relative overflow-hidden rounded-xl border p-5 shadow-sm">
      <div className="from-sun/60 absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent" />
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="tabular mt-3 text-3xl font-semibold tracking-[-0.03em]">{value}</div>
      <div className="text-muted-foreground mt-1.5 text-xs">{detail}</div>
    </div>
  );
}

function App() {
  const [settings, setSettings] = useSettings();
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const activeSeries = useMemo(
    () => buildSeries(settings.places, settings.events, settings.scenarios),
    [settings.events, settings.places, settings.scenarios],
  );
  const calculationSeries = useMemo(
    () =>
      buildSeries(
        settings.places,
        [...new Set([...settings.events, "sunrise" as const, "sunset" as const])],
        [...new Set([...settings.scenarios, "current" as const, "permanentDst" as const])],
      ),
    [settings.events, settings.places, settings.scenarios],
  );
  const points = useMemo(
    () => calculateYear(settings.places, settings.year, calculationSeries),
    [calculationSeries, settings.places, settings.year],
  );

  const visibleSeries = activeSeries.filter(({ key }) => !settings.hiddenSeries.includes(key));
  const primary = settings.places[0];

  // Which chart to draw. Seeded from the URL so a shared link opens on the same
  // view; the toggle writes it back so choosing a view keeps the link shareable.
  const [chartView, setChartView] = useState(() => readChartView(window.location));
  const chooseVariant = (variant: ChartVariant) => {
    setChartView((current) => ({ ...current, variant }));
    const params = new URLSearchParams(window.location.search);
    if (variant === "classic") params.delete(CHART_PARAM);
    else params.set(CHART_PARAM, variant);
    // Written straight to the URL because writeUrl in useSettings rebuilds the
    // whole query string from window.location and would otherwise overwrite it.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
  };
  // The sun path shows one day. December 21 is where the scenarios differ most,
  // so it is the honest default rather than January 1.
  const [focusDay, setFocusDay] = useState<number | null>(null);
  const solsticeDay = Math.max(0, points.findIndex((point) => point.isoDate.endsWith("-12-21")));
  const focusIndex = Math.min(points.length - 1, focusDay ?? solsticeDay);
  const focusPoint = points[focusIndex];
  // Reuse the schedule the reader may already have set instead of inventing one.
  const morningMarker = settings.markers.find((marker) => marker.kind === "morning");
  const compareScenario =
    settings.scenarios.find((scenario) => scenario !== "current") ?? "permanentDst";
  const primaryOffsets = scenarioOffsets(primary.timezone, settings.year);
  const twilightOn = TWILIGHT_EVENTS.every((event) => settings.events.includes(event));

  const latestProposedSunrise = summarizeSeries(
    points,
    seriesKey(primary.id, "sunrise", "permanentDst"),
    "max",
  );
  const earliestProposedSunset = summarizeSeries(
    points,
    seriesKey(primary.id, "sunset", "permanentDst"),
    "min",
  );
  const changedDays = points.filter((point) => {
    const current = point[seriesKey(primary.id, "sunrise", "current")];
    const proposed = point[seriesKey(primary.id, "sunrise", "permanentDst")];
    return typeof current === "number" && typeof proposed === "number" && Math.abs(proposed - current) > 30;
  }).length;

  const setEvents = (events: EventType[]) =>
    setSettings((current) => ({ ...current, events }));
  const toggleTwilight = (pressed: boolean) =>
    setSettings((current) => ({
      ...current,
      events: pressed
        ? [...new Set([...current.events, ...TWILIGHT_EVENTS])]
        : current.events.filter((event) => !TWILIGHT_EVENTS.includes(event)),
    }));

  const exportCsv = () => {
    const header = ["date", ...visibleSeries.map((item) => `${item.label} (local time)`)]
      .map(csvCell)
      .join(",");
    const rows = points.map((point) =>
      [point.isoDate, ...visibleSeries.map((item) => formatMinute(point[item.key] as number | null, true))]
        .map(csvCell)
        .join(","),
    );
    const methodology = `# Generated by What If DST?; year=${settings.year}; locations=${settings.places
      .map(placeLabel)
      .join(" | ")}; methodology=/methodology`;
    downloadBlob(
      `${methodology}\n${header}\n${rows.join("\n")}`,
      "text/csv;charset=utf-8",
      `whatifdst-${settings.year}.csv`,
    );
    toast.success("CSV downloaded");
  };

  const exportPng = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: palette.exportBackground,
      });
      const anchor = document.createElement("a");
      anchor.download = `whatifdst-${settings.year}.png`;
      anchor.href = dataUrl;
      anchor.click();
      toast.success("Chart downloaded");
    } catch {
      toast.error("The image could not be created in this browser.");
    } finally {
      setExporting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Shareable link copied");
    } catch {
      toast.error("Copying is blocked in this browser.");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-svh flex-col">
        <a
          href="#chart"
          className="bg-primary text-primary-foreground sr-only z-100 rounded-md px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
        >
          Skip to the chart
        </a>

        <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
            <a href="#top" className="flex items-center gap-2.5" aria-label="What If DST? home">
              <span className="bg-sun text-sun-foreground ring-sun/20 grid size-7 place-items-center rounded-lg ring-4">
                <Sun className="size-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">What If DST?</span>
            </a>
            <div className="flex items-center gap-1">
              <nav
                aria-label="Primary navigation"
                className="text-muted-foreground mr-1 hidden items-center gap-1 text-sm sm:flex"
              >
                <a
                  href="#explainer"
                  className="hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 transition-colors"
                >
                  The proposal
                </a>
                <a
                  href="#methodology"
                  className="hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 transition-colors"
                >
                  Methodology
                </a>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="top" className="flex-1">
          {/* Hero */}
          <section className="grain relative overflow-hidden">
            <div
              className="from-sun/12 pointer-events-none absolute inset-x-0 -top-40 h-96 bg-radial-[ellipse_at_50%_0%] to-transparent"
              aria-hidden="true"
            />
            <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
              <div className="max-w-3xl">
                <Badge variant="sun" className="mb-6 gap-1.5 px-3 py-1">
                  <span className="bg-sun size-1.5 rounded-full" aria-hidden="true" />
                  Sunshine Protection Act · H.R. 139
                </Badge>
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:text-7xl lg:leading-[0.98]">
                  What would permanent daylight saving time{" "}
                  <span className="text-sun">feel like</span>?
                </h1>
                <p className="text-muted-foreground mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
                  See every sunrise and sunset for a full year under current US law, permanent
                  daylight time, and permanent standard time — where you actually live.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button size="lg" asChild>
                    <a href="#chart">
                      Chart my city
                      <ChevronDown className="size-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="ghost" asChild>
                    <a href="#explainer">
                      How the shift works
                      <ArrowUpRight className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Workspace */}
          <section
            id="chart"
            aria-labelledby="chart-heading"
            className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 pb-24 sm:px-6"
          >
            {/* Toolbar */}
            <div className="bg-card mb-4 rounded-xl border p-4 shadow-sm">
              <LocationSearch
                places={settings.places}
                onAdd={(place) =>
                  setSettings((current) =>
                    current.places.some(({ id }) => id === place.id)
                      ? current
                      : { ...current, places: [...current.places, place].slice(0, 4), hiddenSeries: [] },
                  )
                }
                onRemove={(id) =>
                  setSettings((current) => ({
                    ...current,
                    places: current.places.filter((place) => place.id !== id),
                    hiddenSeries: current.hiddenSeries.filter((key) => !key.startsWith(`${id}|`)),
                  }))
                }
              />

              <Separator className="my-4" />

              <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
                <div className="flex flex-col gap-2">
                  <FieldLabel>Year</FieldLabel>
                  <Select
                    value={String(settings.year)}
                    onValueChange={(value) =>
                      setSettings((current) => ({ ...current, year: Number(value) }))
                    }
                  >
                    <SelectTrigger className="tabular w-28" aria-label="Chart year">
                      <span className="flex items-center gap-2">
                        <CalendarDays className="text-muted-foreground size-4" aria-hidden="true" />
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="tabular">
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <FieldLabel>Events</FieldLabel>
                  {/* The scroll container sits outside the group so the group keeps its padding. */}
                  <div className="max-w-full overflow-x-auto">
                    <ToggleGroup
                      type="multiple"
                      value={settings.events.filter((event) => !TWILIGHT_EVENTS.includes(event))}
                      onValueChange={(value) =>
                        setEvents([
                          ...(value as EventType[]),
                          ...settings.events.filter((event) => TWILIGHT_EVENTS.includes(event)),
                        ])
                      }
                      aria-label="Solar events"
                    >
                      {EVENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                        <ToggleGroupItem key={value} value={value} className="px-3">
                          <Icon aria-hidden="true" />
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <FieldLabel>Clock policy</FieldLabel>
                  <div className="max-w-full overflow-x-auto">
                    <ToggleGroup
                      type="multiple"
                      value={settings.scenarios}
                      onValueChange={(value) =>
                        setSettings((current) => ({ ...current, scenarios: value as Scenario[] }))
                      }
                      aria-label="Time policies"
                    >
                      {SCENARIO_OPTIONS.map(({ value, label }) => (
                        <ToggleGroupItem key={value} value={value} className="px-3">
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>More light</FieldLabel>
                  <Toggle
                    pressed={twilightOn}
                    onPressedChange={toggleTwilight}
                    aria-label="Show civil twilight"
                  >
                    <MoonStar aria-hidden="true" />
                    Civil twilight
                  </Toggle>
                </div>

                <label className="ml-auto flex h-9 cursor-pointer items-center gap-2.5 text-xs font-medium">
                  <Switch
                    checked={settings.use24Hour}
                    onCheckedChange={(checked) =>
                      setSettings((current) => ({ ...current, use24Hour: checked }))
                    }
                    aria-label="Use 24-hour time"
                  />
                  24-hour clock
                </label>
              </div>
            </div>

            {/* Chart */}
            <div ref={exportRef} className="bg-card rounded-xl border p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sun mb-1 text-[11px] font-semibold tracking-[0.1em] uppercase">
                    {settings.year} · local clock time
                  </div>
                  <h2 id="chart-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {chartView.variant === "sunpath" && !chartView.compare
                      ? "The sun's path through one day"
                      : "Sunrise & sunset through the year"}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2" data-html2canvas-ignore="true">
                  {!chartView.compare && (
                    <ToggleGroup
                      type="single"
                      value={chartView.variant}
                      onValueChange={(value) => value && chooseVariant(value as ChartVariant)}
                      aria-label="Chart view"
                      className="mr-1"
                    >
                      {CHART_VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
                        <ToggleGroupItem key={value} value={value} className="px-3">
                          <Icon aria-hidden="true" />
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                  <Button variant="outline" size="sm" onClick={copyLink}>
                    <Link2 aria-hidden="true" />
                    Copy link
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={exporting}>
                        <Download aria-hidden="true" />
                        {exporting ? "Exporting…" : "Export"}
                        <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={exportPng}>
                        <ImageIcon aria-hidden="true" />
                        Chart as PNG
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={exportCsv}>
                        <FileDown aria-hidden="true" />
                        Daily data as CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {(chartView.compare || chartView.variant === "classic") &&
                (activeSeries.length ? (
                  <>
                    {chartView.compare && <VariantHeading>Year chart</VariantHeading>}
                    <DaylightChart
                      points={points}
                      series={activeSeries}
                      hiddenSeries={settings.hiddenSeries}
                      places={settings.places}
                      year={settings.year}
                      markers={settings.markers}
                      use24Hour={settings.use24Hour}
                    />
                  </>
                ) : (
                  <div className="text-muted-foreground flex h-[440px] flex-col items-center justify-center gap-2 sm:h-[500px]">
                    <Sun className="text-sun size-7" aria-hidden="true" />
                    <strong className="text-foreground text-sm font-semibold">No lines selected</strong>
                    <span className="text-sm">Turn on a solar event and a clock policy above.</span>
                  </div>
                ))}

              {(chartView.compare || chartView.variant === "sunpath") && (
                <div className={chartView.compare ? "mt-8" : undefined}>
                  {chartView.compare && <VariantHeading>Sun path · one day</VariantHeading>}
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <label className="text-muted-foreground flex items-center gap-2.5 text-xs font-medium">
                      Date
                      <input
                        type="range"
                        min={0}
                        max={points.length - 1}
                        value={focusIndex}
                        onChange={(event) => setFocusDay(Number(event.target.value))}
                        className="accent-sun w-44 max-w-[45vw]"
                        aria-label="Day of year"
                      />
                      <b className="text-foreground tabular font-medium">{focusPoint.dateLabel}</b>
                    </label>
                    {!morningMarker && (
                      <span className="text-muted-foreground/70 text-xs">
                        Add a morning time in “Add your schedule” to pin your alarm.
                      </span>
                    )}
                  </div>
                  <SunPathPanel
                    place={primary}
                    year={settings.year}
                    isoDate={focusPoint.isoDate}
                    dateLabel={focusPoint.dateLabel}
                    compare={compareScenario}
                    alarmMinute={morningMarker ? parseTime(morningMarker.time) : null}
                    alarmLabel={morningMarker?.label ?? "Alarm"}
                    use24Hour={settings.use24Hour}
                  />
                </div>
              )}

              {/* Colour-by-place and dash-by-scenario describe the year chart's
                  lines, so they only belong on screen when that chart is drawn. */}
              {(chartView.compare || chartView.variant === "classic") && (
                <>
                  {/* Padded on both sides: the rule below comes from SeriesControls,
                      so a top-only pad left the key sitting on that rule. */}
                  <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t py-4 text-xs">
                    {/* Hue means the event, so the first key on the row says so.
                        Shade within the hue is what separates places. */}
                    <span className="flex items-center gap-2">
                      <span
                        className="h-0.5 w-5 rounded-full"
                        style={{ background: palette.event.warm[0] }}
                        aria-hidden="true"
                      />
                      Sunrise
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-0.5 w-5 rounded-full"
                        style={{ background: palette.event.cool[0] }}
                        aria-hidden="true"
                      />
                      Sunset
                    </span>
                    {/* One location is already named in the picker above, so the
                        key only appears once there are places to tell apart. */}
                    {settings.places.length > 1 && (
                      <>
                        <span className="bg-border mx-1 hidden h-4 w-px sm:block" aria-hidden="true" />
                        {settings.places.map((place, index) => (
                          <span key={place.id} className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: placeSwatch(palette, index) }}
                              aria-hidden="true"
                            />
                            {place.city}, {place.state}
                          </span>
                        ))}
                      </>
                    )}
                    <span className="bg-border mx-1 hidden h-4 w-px sm:block" aria-hidden="true" />
                    {SCENARIO_OPTIONS.map(({ value, label }) => (
                      <span key={value} className="flex items-center gap-2">
                        <SeriesSwatch color="currentColor" scenario={value} />
                        {label}
                      </span>
                    ))}
                  </div>

                  <SeriesControls
                    series={activeSeries}
                    hidden={settings.hiddenSeries}
                    onToggle={(key) =>
                      setSettings((current) => ({
                        ...current,
                        hiddenSeries: current.hiddenSeries.includes(key)
                          ? current.hiddenSeries.filter((item) => item !== key)
                          : [...current.hiddenSeries, key],
                      }))
                    }
                  />
                </>
              )}
            </div>

            {/* Takeaways */}
            <div
              className="mt-4 grid gap-3 sm:grid-cols-3"
              aria-label={`Key takeaways for ${placeLabel(primary)}`}
            >
              <StatCard
                label="Latest proposed sunrise"
                value={
                  latestProposedSunrise
                    ? formatMinute(
                        latestProposedSunrise[seriesKey(primary.id, "sunrise", "permanentDst")] as number,
                        settings.use24Hour,
                      )
                    : "No sunrise"
                }
                detail={`${latestProposedSunrise?.dateLabel ?? "Polar conditions"} in ${primary.city}`}
              />
              <StatCard
                label="Earliest proposed sunset"
                value={
                  earliestProposedSunset
                    ? formatMinute(
                        earliestProposedSunset[seriesKey(primary.id, "sunset", "permanentDst")] as number,
                        settings.use24Hour,
                      )
                    : "No sunset"
                }
                detail={`${earliestProposedSunset?.dateLabel ?? "Polar conditions"} in ${primary.city}`}
              />
              <StatCard
                label="Days shifted vs. current law"
                value={String(changedDays)}
                detail={
                  primaryOffsets.observesDst
                    ? "One hour later on the clock"
                    : "This jurisdiction does not change clocks"
                }
              />
            </div>

            {/* min-w-0 on the children: grid items default to min-width:auto, which
                would let the wide data table stretch the whole page. */}
            <div className="mt-3 grid grid-cols-1 gap-3 [&>*]:min-w-0">
              <SchedulePanel
                markers={settings.markers}
                points={points}
                primaryPlace={primary}
                use24Hour={settings.use24Hour}
                onChange={(markers) => setSettings((current) => ({ ...current, markers }))}
              />
              <DailyTable points={points} series={visibleSeries} use24Hour={settings.use24Hour} />
            </div>
          </section>

          {/* Explainer */}
          <section id="explainer" className="border-t">
            <div className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
              <SectionHeading
                index="01"
                eyebrow="Understand the change"
                title="Same sun. A different number on the clock."
              />

              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
                <ClockShiftDiagram points={points} place={primary} use24Hour={settings.use24Hour} />

                <div className="grid gap-6 self-center sm:grid-cols-2 lg:grid-cols-1 lg:gap-7">
                  {[
                    {
                      tag: "Current law",
                      title: "Clocks change twice a year",
                      body: "Most of the US advances clocks on the second Sunday in March and returns to standard time on the first Sunday in November.",
                    },
                    {
                      tag: "Proposed policy",
                      title: "Keep the advanced clock year-round",
                      body: "The Sunshine Protection Act would make today's daylight time the new permanent standard, while preserving a choice for currently exempt jurisdictions.",
                    },
                    {
                      tag: "What the curves reveal",
                      title: "The difference lives in winter",
                      body: "During the current DST season, the current-law and permanent-DST lines overlap exactly. Outside it, permanent DST shifts both events one hour later.",
                    },
                  ].map((item) => (
                    <div key={item.tag} className="border-l-2 pl-5">
                      <div className="text-sun text-[11px] font-semibold tracking-[0.1em] uppercase">
                        {item.tag}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight">{item.title}</h3>
                      <p className="text-muted-foreground mt-1.5 text-sm">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Evidence */}
          <section className="bg-band border-y border-white/10 text-white">
            <div className="mx-auto w-full max-w-[1200px] px-4 py-20 sm:px-6 sm:py-28">
              <SectionHeading
                index="02"
                eyebrow="Context, not a verdict"
                title="The tradeoffs are broader than evening light."
                invert
              />

              <div className="grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-2">
                {[
                  {
                    title: "Morning and evening",
                    body: "Permanent DST creates later winter sunrises and later winter sunsets by the same one-hour shift. Whether that feels beneficial depends heavily on latitude, longitude within a time zone, and daily schedule.",
                  },
                  {
                    title: "Health and circadian timing",
                    body: "The American Academy of Sleep Medicine supports ending seasonal clock changes but recommends permanent standard time, arguing that it aligns more closely with human circadian biology.",
                    href: "https://aasm.org/advocacy/position-statements/permanent-standard-time-is-the-optimal-choice-for-health-and-safety/",
                    linkText: "Read the AASM position",
                  },
                  {
                    title: "Energy and safety evidence",
                    body: "Federal reviews of the 1974–75 experiment found the measurable effects difficult to separate from other changes. Reported benefits were modest and the overall evidence was not unambiguous.",
                    href: "https://www.congress.gov/crs-product/R45208",
                    linkText: "Read the CRS review",
                  },
                  {
                    title: "The 1974 experiment",
                    body: "The US enacted a temporary year-round DST trial during the energy crisis. Congress restored a winter standard-time period before the original trial was due to end.",
                    href: "https://www.congress.gov/crs-product/R45208",
                    linkText: "Explore the history",
                  },
                ].map((item) => (
                  <article
                    key={item.title}
                    className="bg-band-card flex flex-col gap-3 p-7 transition-colors hover:bg-white/6 sm:p-9"
                  >
                    <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                    <p className="text-sm text-white/60">{item.body}</p>
                    {item.href && (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sun mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium hover:underline"
                      >
                        {item.linkText}
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </article>
                ))}
              </div>

              <aside className="mt-6 flex gap-3.5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <Info className="text-sun mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p className="text-sm text-white/60">
                  <strong className="font-semibold text-white">
                    This site does not take a position.
                  </strong>{" "}
                  The chart calculates clock-time consequences. Research summaries describe the stated
                  conclusions of their sources and should not be read as causal estimates for a
                  specific community.
                </p>
              </aside>
            </div>
          </section>

          {/* Methodology */}
          <section id="methodology">
            <div className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
              <SectionHeading
                index="03"
                eyebrow="Methodology"
                title="What is — and is not — being calculated."
              />

              <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
                {[
                  {
                    title: "Astronomical events",
                    body: "Daily sunrise, sunset, civil dawn, and civil dusk are calculated from the selected location's coordinates using the open-source SunCalc astronomical formulas. Official sunrise and sunset use the conventional solar altitude of −0.833°.",
                  },
                  {
                    title: "Clock policies",
                    body: "Current law uses the location's time-zone rules for the selected year. Permanent DST uses that zone's daylight offset all year; permanent standard uses its standard offset all year. Locations that do not observe DST remain unchanged in the proposed scenario.",
                  },
                  {
                    title: "Location precision",
                    body: "City searches use an averaged city coordinate; ZIP searches use a ZIP-code coordinate. Times can differ by several minutes across a large city or ZIP. “Use my location” selects the nearest bundled city and does not transmit or store precise coordinates.",
                  },
                  {
                    title: "Limits",
                    body: "Atmospheric refraction, elevation, terrain, and local horizons can change the sunrise you observe. Polar day or night appears as a gap. Future time-zone rules may change, so future years are illustrative.",
                  },
                ].map((item) => (
                  <div key={item.title} className="border-t pt-5">
                    <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 mt-12 rounded-xl border p-6">
                <h3 className="mb-4 text-sm font-semibold">Primary references</h3>
                <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {[
                    {
                      href: "https://www.congress.gov/bill/119th-congress/house-bill/139/text",
                      label: "Sunshine Protection Act of 2025, H.R. 139",
                    },
                    {
                      href: "https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst",
                      label: "NIST daylight saving time rules",
                    },
                    {
                      href: "https://www.transportation.gov/regulations/daylight-saving-time",
                      label: "US DOT daylight saving time overview",
                    },
                    { href: "https://github.com/mourner/suncalc", label: "SunCalc calculation library" },
                  ].map((source) => (
                    <a
                      key={source.href}
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-1.5 py-1 text-sm transition-colors"
                    >
                      {source.label}
                      <ArrowUpRight
                        className="size-3.5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t">
          <div className="text-muted-foreground mx-auto flex w-full max-w-[1200px] flex-col items-start gap-4 px-4 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="bg-sun text-sun-foreground grid size-6 place-items-center rounded-md">
                <Sun className="size-3.5" />
              </span>
              <span className="text-foreground font-semibold">What If DST?</span>
            </div>
            <p className="max-w-md sm:text-center">
              Built for informational purposes. Times are estimates, not legal or navigational advice.
            </p>
            <a href="#top" className="hover:text-foreground transition-colors">
              Back to top ↑
            </a>
          </div>
        </footer>

        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
