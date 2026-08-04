import { useMemo } from "react";
import { formatMinute, SCENARIO_LABELS } from "@/lib/daylight";
import {
  HORIZON_DEG,
  maxAnnualAltitude,
  moonHighlight,
  sunAltitude,
} from "@/lib/sun-path";
import type { Place, Scenario } from "@/types";

interface Props {
  place: Place;
  year: number;
  isoDate: string;
  dateLabel: string;
  /** The scenario drawn as the amber overlay. */
  compare: Scenario;
  /** Clock minute to mark on both arcs, or null to leave it off. */
  alarmMinute: number | null;
  alarmLabel: string;
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
const H = 360;
const PAD_X = 20;
const TOP = 26;
const PLOT_H = 292;
const PLOT_W = W - PAD_X * 2;
// Everything below this is uniformly night, so clipping there costs no
// information and buys height for the part worth reading.
const ALT_LO = -22;

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
  alarmMinute,
  alarmLabel,
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

    // Drawn at its true altitude, but kept clear of the edges so the disc is
    // never sliced in half. A winter full moon really does ride near the top of
    // the sky, which would otherwise put it straight through the panel border.
    const moonState = moonHighlight(place, isoDate, year, "current");
    const moon = moonState && {
      ...moonState,
      drawY: Math.max(TOP + 18, Math.min(TOP + PLOT_H - 18, y(moonState.altitude))),
    };

    const stars: Array<{ cx: number; cy: number; r: number; opacity: number }> = [];
    const horizonY = y(HORIZON_DEG);
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

    const alarm =
      alarmMinute === null
        ? null
        : {
            minute: alarmMinute,
            baseline: sunAltitude(place, isoDate, year, "current", alarmMinute),
            compare: sunAltitude(place, isoDate, year, compare, alarmMinute),
          };

    return { altHi, y, horizonY, arc, hourlySun, moon, stars, alarm };
  }, [alarmMinute, compare, isoDate, place, year]);

  const { y, horizonY, altHi } = view;
  const peakY = y(maxAnnualAltitude(place.latitude));
  const clipId = `sun-path-clip-${place.id}`;
  const glowId = `sun-path-glow-${place.id}`;

  const readouts = (["current", compare] as const).map((scenario) => ({
    scenario,
    label: SCENARIO_LABELS[scenario],
    altitude: scenario === "current" ? view.alarm?.baseline : view.alarm?.compare,
  }));

  return (
    <div className="tabular">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`The sun's path on ${dateLabel} in ${place.city}, ${place.state}, under current law and ${SCENARIO_LABELS[compare]}.`}
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
              <circle cx={x(view.moon.clockMinute)} cy={view.moon.drawY} r={34} fill={`url(#${glowId})`} opacity={0.16 * view.moon.fraction} />
              <circle cx={x(view.moon.clockMinute)} cy={view.moon.drawY} r={13} fill={SKY.moonShadow} />
              <path
                d={moonPath(x(view.moon.clockMinute), view.moon.drawY, 13, view.moon.fraction)}
                fill={SKY.moon}
                transform={view.moon.waxing ? undefined : `translate(${2 * x(view.moon.clockMinute)} 0) scale(-1 1)`}
              />
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

          {view.alarm && (
            <g>
              <line x1={x(view.alarm.minute)} x2={x(view.alarm.minute)} y1={TOP} y2={TOP + PLOT_H} stroke={SKY.hair} strokeOpacity={0.8} strokeWidth={1.5} />
              {[
                { altitude: view.alarm.baseline, fill: SKY.hair },
                { altitude: view.alarm.compare, fill: SKY.accent },
              ].map((dot, index) => (
                <circle
                  key={index}
                  cx={x(view.alarm!.minute)}
                  cy={y(Math.max(ALT_LO, Math.min(altHi, dot.altitude)))}
                  r={6.5}
                  fill={dot.fill}
                  stroke="#0b1220"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </g>

        {view.alarm && (
          <text x={x(view.alarm.minute)} y={TOP - 8} textAnchor="middle" fill="currentColor" fontSize={11} fontWeight={620}>
            {`${alarmLabel} ${formatMinute(view.alarm.minute, use24Hour)}`}
          </text>
        )}

        {Array.from({ length: 9 }, (_, index) => index * 3).map((hour) => (
          <text key={hour} x={x(hour * 60)} y={H - 10} textAnchor="middle" fill="currentColor" opacity={0.55} fontSize={11}>
            {hourLabel(hour)}
          </text>
        ))}
      </svg>

      {view.alarm && (
        <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {readouts.map(({ scenario, label, altitude }) => (
            <span key={scenario} className="inline-flex items-center gap-2">
              <i
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ background: scenario === "current" ? SKY.hair : SKY.accent }}
              />
              {label}:{" "}
              <b className="text-foreground font-medium">
                {altitude !== undefined && altitude > HORIZON_DEG
                  ? "sun is up"
                  : `${altitude?.toFixed(1)}° below`}
              </b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
