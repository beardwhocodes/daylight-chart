import { useMemo } from "react";
import { formatMinute, parseTime, SCENARIO_LABELS } from "@/lib/daylight";
import {
  HORIZON_DEG,
  maxAnnualAltitude,
  moonTrack,
  sunAltitude,
} from "@/lib/sun-path";
import type { Place, Scenario, ScheduleMarker } from "@/types";

interface Props {
  place: Place;
  year: number;
  isoDate: string;
  dateLabel: string;
  /** The scenario drawn as the amber overlay. */
  compare: Scenario;
  /** Every schedule time the reader has set, drawn as a pin on both arcs. */
  markers: ScheduleMarker[];
  use24Hour: boolean;
}

/**
 * Concrete hex rather than CSS custom properties, matching chart-theme.ts:
 * the PNG export clones the chart into a detached document where `var(--…)`
 * would not resolve. The sky keeps these values in both themes because night
 * is dark regardless of the reader's preference.
 */
const SKY = {
  lit: "#4b7cad",
  unlit: "#101d31",
  hair: "#ffffff",
  accent: "#ff9f0a",
  sun: "#ffd76b",
  sunEdge: "#fff6dc",
  sunDown: "#2b3a5c",
  sunDownEdge: "#66739b",
  moon: "#eef1ff",
  moonShadow: "#26304f",
  ink: "#ffffff",
} as const;

const W = 1000;
const H = 372;
const PAD_X = 20;
const TOP = 26;
const PLOT_H = 292;
const PLOT_W = W - PAD_X * 2;
// Everything below this is uniformly night, so clipping there costs no
// information and buys height for the part worth reading.
const ALT_LO = -22;
const MOON_R = 13;

const x = (minute: number) => PAD_X + (minute / 1440) * PLOT_W;

/** Deterministic, so the star field does not reshuffle on every render. */
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * The lit limb, then a terminator ellipse back to the start. The terminator's
 * x-radius collapses to zero at the quarters and grows to a full circle at new
 * and full; its sweep flips between crescent and gibbous, which is what makes
 * the shape read correctly at every phase.
 */
function moonPath(cx: number, cy: number, r: number, fraction: number) {
  const rx = r * Math.abs(2 * fraction - 1);
  const sweep = fraction < 0.5 ? 0 : 1;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx} ${r} 0 0 ${sweep} ${cx} ${cy - r} Z`;
}

const hourLabel = (hour: number) =>
  hour === 0 || hour === 24 ? "12 AM" : hour === 12 ? "12 PM" : hour < 12 ? `${hour} AM` : `${hour - 12} PM`;

export function SunPathPanel({
  place,
  year,
  isoDate,
  dateLabel,
  compare,
  markers,
  use24Hour,
}: Props) {
  const view = useMemo(() => {
    const altHi = Math.max(30, maxAnnualAltitude(place.latitude));
    const y = (altitude: number) => TOP + (PLOT_H * (altHi - altitude)) / (altHi - ALT_LO);
    const clamp = (value: number) => Math.max(TOP - 4, Math.min(TOP + PLOT_H + 4, value));

    const arc = (scenario: Scenario) => {
      let d = "";
      for (let minute = 0; minute <= 1440; minute += 4) {
        const point = `${x(minute).toFixed(1)} ${clamp(y(sunAltitude(place, isoDate, year, scenario, minute))).toFixed(1)}`;
        d += (minute ? "L" : "M") + point;
      }
      return d;
    };

    const hourlySun = Array.from({ length: 24 }, (_, hour) => {
      const altitude = sunAltitude(place, isoDate, year, "current", hour * 60);
      return { hour, altitude, up: altitude > HORIZON_DEG };
    }).filter((entry) => entry.altitude > ALT_LO - 2);

    const horizonY = y(HORIZON_DEG);

    /**
     * One moon, sitting in the night sky rather than tracing its own arc. Its
     * time and phase are real: it is placed at the hour it climbs highest while
     * the sky is dark, drawn at its true illuminated fraction, and turned so the
     * lit edge faces the sun as it does overhead.
     *
     * Its HEIGHT is not its altitude. The panel's vertical axis belongs to the
     * sun, and a moon plotted honestly against it spends most of the night above
     * the horizon line, in the lit tone, which reads as a second sun. Placing it
     * in the dark band keeps the panel about the sun and the moon as context.
     */
    const moon = (() => {
      const dark = moonTrack(place, isoDate, year, "current").filter(
        (sample) => sample.sunAltitude < -6,
      );
      if (!dark.length) return null;
      const best = dark.reduce((a, b) => (b.altitude > a.altitude ? b : a));
      return {
        ...best,
        cx: x(best.clockMinute),
        cy: horizonY + (TOP + PLOT_H - horizonY) * 0.4,
      };
    })();

    const stars: Array<{ cx: number; cy: number; r: number; opacity: number }> = [];
    const rng = makeRng(Math.round(new Date(isoDate).getTime() / 86400000));
    for (let i = 0; i < 220; i += 1) {
      const cx = PAD_X + rng() * PLOT_W;
      const cy = horizonY + rng() * (TOP + PLOT_H - horizonY);
      const jitter = rng();
      stars.push({
        cx,
        cy,
        r: 0.4 + jitter,
        // Fade in below the horizon line so stars do not butt against it.
        opacity: (0.2 + jitter * 0.55) * Math.min(1, (cy - horizonY) / 40),
      });
    }

    // Every marker, not just the morning one: an evening commute is exactly the
    // time permanent standard would move, so leaving it out hid half the story.
    const pins = markers.map((marker) => {
      const minute = parseTime(marker.time);
      return {
        id: marker.id,
        label: marker.label,
        minute,
        baseline: sunAltitude(place, isoDate, year, "current", minute),
        compare: sunAltitude(place, isoDate, year, compare, minute),
      };
    });

    return { altHi, y, horizonY, arc, hourlySun, moon, stars, pins };
  }, [compare, isoDate, markers, place, year]);

  const { y, horizonY, altHi } = view;
  const peakY = y(maxAnnualAltitude(place.latitude));
  const clipId = `sun-path-clip-${place.id}`;
  const glowId = `sun-path-glow-${place.id}`;

  return (
    <div className="tabular">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`The sun's path on ${dateLabel} in ${place.city}, ${place.state}, under current law and ${SCENARIO_LABELS[compare]}, with the moon shown in the night sky at its phase.`}
      >
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ffcf5c" stopOpacity="0" />
          </radialGradient>
          <clipPath id={clipId}>
            <rect x={PAD_X} y={TOP} width={PLOT_W} height={PLOT_H} rx={14} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* Two tones split by the horizon: above it the sun is up. */}
          <rect x={PAD_X} y={TOP} width={PLOT_W} height={PLOT_H} fill={SKY.lit} />
          <rect x={PAD_X} y={horizonY} width={PLOT_W} height={TOP + PLOT_H - horizonY} fill={SKY.unlit} />

          {view.stars.map((star, index) => (
            <circle key={index} cx={star.cx} cy={star.cy} r={star.r} fill={SKY.hair} opacity={star.opacity} />
          ))}

          {view.moon && (
            <g>
              <circle cx={view.moon.cx} cy={view.moon.cy} r={MOON_R * 2.6} fill={`url(#${glowId})`} opacity={0.16 * view.moon.fraction} />
              <circle cx={view.moon.cx} cy={view.moon.cy} r={MOON_R} fill={SKY.moonShadow} />
              {/* Turned so the lit edge faces the sun, which is why the crescent
                  tips rather than standing upright. */}
              <g transform={`rotate(${view.moon.limbRotation.toFixed(1)} ${view.moon.cx.toFixed(1)} ${view.moon.cy.toFixed(1)})`}>
                <path d={moonPath(view.moon.cx, view.moon.cy, MOON_R, view.moon.fraction)} fill={SKY.moon} />
              </g>
            </g>
          )}

          {/* How far below its own annual maximum this day peaks. */}
          <line x1={PAD_X} x2={PAD_X + PLOT_W} y1={peakY} y2={peakY} stroke={SKY.hair} strokeWidth={1} strokeDasharray="2 6" opacity={0.3} />
          {/* Cased, because the moon can pass behind it and white on white
              disappears. Same trick a map label uses over arbitrary terrain. */}
          <text
            x={PAD_X + PLOT_W - 10}
            y={peakY + 14}
            textAnchor="end"
            fill={SKY.hair}
            opacity={0.55}
            fontSize={11}
            stroke="#0b1220"
            strokeWidth={3}
            strokeOpacity={0.55}
            paintOrder="stroke"
          >
            {`year's highest sun ${altHi.toFixed(0)}°`}
          </text>

          <path d={view.arc("current")} fill="none" stroke={SKY.hair} strokeOpacity={0.34} strokeWidth={1.5} />
          <path d={view.arc(compare)} fill="none" stroke={SKY.accent} strokeWidth={2} />

          {view.hourlySun.map(({ hour, altitude, up }) =>
            up ? (
              <g key={hour}>
                <circle cx={x(hour * 60)} cy={y(altitude)} r={15} fill={`url(#${glowId})`} />
                <circle cx={x(hour * 60)} cy={y(altitude)} r={6} fill={SKY.sun} stroke={SKY.sunEdge} strokeWidth={1.2} />
              </g>
            ) : (
              <circle key={hour} cx={x(hour * 60)} cy={y(altitude)} r={3.2} fill={SKY.sunDown} stroke={SKY.sunDownEdge} strokeWidth={1} />
            ),
          )}

          <line x1={PAD_X} x2={PAD_X + PLOT_W} y1={horizonY} y2={horizonY} stroke={SKY.hair} strokeOpacity={0.75} strokeWidth={1} />
          <text
            x={PAD_X + 10}
            y={horizonY - 7}
            fill={SKY.hair}
            opacity={0.7}
            fontSize={11}
            stroke="#0b1220"
            strokeWidth={3}
            strokeOpacity={0.5}
            paintOrder="stroke"
          >
            horizon
          </text>

          {view.pins.map((pin) => (
            <g key={pin.id}>
              <line x1={x(pin.minute)} x2={x(pin.minute)} y1={TOP} y2={TOP + PLOT_H} stroke={SKY.hair} strokeOpacity={0.8} strokeWidth={1.5} />
              {[
                { altitude: pin.baseline, fill: SKY.hair },
                { altitude: pin.compare, fill: SKY.accent },
              ].map((dot, index) => (
                <circle
                  key={index}
                  cx={x(pin.minute)}
                  cy={y(Math.max(ALT_LO, Math.min(altHi, dot.altitude)))}
                  r={6.5}
                  fill={dot.fill}
                  stroke="#0b1220"
                  strokeWidth={2}
                />
              ))}
            </g>
          ))}
        </g>

        {view.pins.map((pin) => (
          <text key={pin.id} x={x(pin.minute)} y={TOP - 8} textAnchor="middle" fill="currentColor" fontSize={11} fontWeight={620}>
            {`${pin.label} ${formatMinute(pin.minute, use24Hour)}`}
          </text>
        ))}

        {/* An hour mark for every hour, labelled every second one. Sunrise moves
            by minutes between scenarios, so a scale that only spoke every three
            hours left the whole transition floating between two labels. */}
        {Array.from({ length: 25 }, (_, hour) => {
          const labelled = hour % 2 === 0;
          return (
            <g key={hour}>
              <line
                x1={x(hour * 60)}
                x2={x(hour * 60)}
                y1={TOP + PLOT_H + 2}
                y2={TOP + PLOT_H + (labelled ? 8 : 5)}
                stroke="currentColor"
                strokeWidth={1}
                opacity={labelled ? 0.4 : 0.22}
              />
              {labelled && (
                <text
                  x={x(hour * 60)}
                  y={H - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  opacity={0.55}
                  fontSize={10.5}
                >
                  {hourLabel(hour)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-2">
          <i aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SKY.sun }} />
          Sun, each hour · current law
        </span>
        <span className="inline-flex items-center gap-2">
          <i aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ background: SKY.accent }} />
          {SCENARIO_LABELS[compare]}
        </span>
        <span className="inline-flex items-center gap-2">
          <i aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SKY.moon }} />
          Moon, at its phase
        </span>
        {view.pins.length > 0 && (
          <span className="inline-flex items-center gap-2">
            <i aria-hidden="true" className="h-3 w-0.5 rounded-full" style={{ background: SKY.hair }} />
            Your schedule
          </span>
        )}
        <span className="ml-auto">Local clock time · {place.city}</span>
      </div>

      {view.pins.length > 0 && (
        <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
          {view.pins.map((pin) => (
            <div key={pin.id} className="text-xs">
              <div className="text-foreground font-medium">
                {pin.label} · {formatMinute(pin.minute, use24Hour)}
              </div>
              <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {([["current", pin.baseline], [compare, pin.compare]] as const).map(
                  ([scenario, altitude]) => (
                    <span key={scenario} className="inline-flex items-center gap-1.5">
                      <i
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ background: scenario === "current" ? SKY.hair : SKY.accent }}
                      />
                      {SCENARIO_LABELS[scenario]}:{" "}
                      <b className="text-foreground font-medium">
                        {altitude > HORIZON_DEG ? "sun is up" : `${altitude.toFixed(1)}° below`}
                      </b>
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
