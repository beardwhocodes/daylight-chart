import { DateTime } from "luxon";
import SunCalc from "suncalc";
import { scenarioOffsets } from "./daylight";
import type { Place, Scenario } from "../types";

const RAD_TO_DEG = 180 / Math.PI;
const AXIAL_TILT = 23.44;

/** The sun's centre sits this far below the horizon at the moment of sunrise. */
export const HORIZON_DEG = -0.833;

export interface MoonState {
  altitude: number;
  /** Illuminated fraction of the disc: 0 at new moon, 1 at full. */
  fraction: number;
  waxing: boolean;
}

export interface MoonHighlight extends MoonState {
  clockMinute: number;
}

/**
 * Minutes a scenario's clock runs ahead of current law on this date. Permanent
 * DST pushes standard-time days forward an hour and leaves summer alone;
 * permanent standard pulls daylight-time days back one. This is the same rule
 * `minuteForScenario` applies, expressed as an offset instead of a result.
 */
export function scenarioShift(
  place: Place,
  isoDate: string,
  year: number,
  scenario: Scenario,
): number {
  // Midday, so the day's canonical offset is read away from a transition hour.
  const noon = DateTime.fromISO(isoDate, { zone: place.timezone }).set({ hour: 12 });
  const offsets = scenarioOffsets(place.timezone, year);
  if (scenario === "permanentDst") {
    return (offsets.observesDst ? offsets.daylight : noon.offset) - noon.offset;
  }
  if (scenario === "permanentStandard") return offsets.standard - noon.offset;
  return 0;
}

/**
 * The real instant behind a clock reading.
 *
 * The panel's horizontal axis is a clock, and each scenario reads a different
 * clock off the same sky. A reading of `clockMinute` under `scenario` is
 * therefore the instant that current law calls `clockMinute - shift`. Minutes
 * are added as exact duration, so on the two transition days the axis stays a
 * true 24 hours of elapsed time rather than a 23- or 25-hour local day.
 */
export function instantForClock(
  place: Place,
  isoDate: string,
  year: number,
  scenario: Scenario,
  clockMinute: number,
): Date {
  const shift = scenarioShift(place, isoDate, year, scenario);
  return DateTime.fromISO(isoDate, { zone: place.timezone })
    .startOf("day")
    .plus({ minutes: clockMinute - shift })
    .toJSDate();
}

/** Degrees of the sun above the horizon at a clock reading. */
export function sunAltitude(
  place: Place,
  isoDate: string,
  year: number,
  scenario: Scenario,
  clockMinute: number,
): number {
  const at = instantForClock(place, isoDate, year, scenario, clockMinute);
  return SunCalc.getPosition(at, place.latitude, place.longitude).altitude * RAD_TO_DEG;
}

export function moonAt(
  place: Place,
  isoDate: string,
  year: number,
  scenario: Scenario,
  clockMinute: number,
): MoonState {
  const at = instantForClock(place, isoDate, year, scenario, clockMinute);
  const position = SunCalc.getMoonPosition(at, place.latitude, place.longitude);
  const illumination = SunCalc.getMoonIllumination(at);
  return {
    altitude: position.altitude * RAD_TO_DEG,
    fraction: illumination.fraction,
    // SunCalc phase runs 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
    waxing: illumination.phase < 0.5,
  };
}

/**
 * Where the moon is worth drawing: its highest point on this date, provided it
 * is up and the sky is dark enough to see it. Sampled rather than solved,
 * because a coarse scan is exact enough to place a glyph.
 */
export function moonHighlight(
  place: Place,
  isoDate: string,
  year: number,
  scenario: Scenario,
  stepMinutes = 10,
): MoonHighlight | null {
  let best: MoonHighlight | null = null;
  for (let minute = 0; minute < 1440; minute += stepMinutes) {
    if (sunAltitude(place, isoDate, year, scenario, minute) > -6) continue;
    const state = moonAt(place, isoDate, year, scenario, minute);
    if (state.altitude <= 0) continue;
    if (!best || state.altitude > best.altitude) best = { ...state, clockMinute: minute };
  }
  return best;
}

/**
 * The highest the sun ever reaches at this latitude — solstice noon. Drawn as a
 * reference so the empty upper sky reads as "how far below its own maximum this
 * day peaks" rather than as wasted space. Inside the tropics the sun passes
 * directly overhead, so the ceiling is 90.
 */
export function maxAnnualAltitude(latitude: number): number {
  const distance = Math.abs(latitude);
  return distance <= AXIAL_TILT ? 90 : 90 - (distance - AXIAL_TILT);
}
