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
  /**
   * Where the lit edge points, in degrees clockwise on screen, for a glyph
   * drawn with its bright limb toward positive x. The moon's crescent is not
   * upright: it rotates through the night and tips into a bowl near the
   * horizon, because the lit edge always faces the sun.
   */
  limbRotation: number;
}

export interface MoonSample extends MoonState {
  clockMinute: number;
  /** The sun at the same moment. A daytime moon is up but washed out. */
  sunAltitude: number;
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
  // `angle` is the bright limb read from the disc's north point; subtracting the
  // parallactic angle turns it into an angle from the observer's zenith,
  // measured anticlockwise. A glyph drawn with its limb toward +x already sits
  // 90 degrees clockwise of "up", so that offset comes back out here.
  const zenith = (illumination.angle - position.parallacticAngle) * RAD_TO_DEG;
  return {
    altitude: position.altitude * RAD_TO_DEG,
    fraction: illumination.fraction,
    // SunCalc phase runs 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
    waxing: illumination.phase < 0.5,
    limbRotation: -zenith - 90,
  };
}

/**
 * The moon's path across the day, at the same hourly cadence as the sun. Every
 * hour it is above the horizon is reported, daylight included — the moon really
 * is up in the afternoon sky, it is simply hard to see. Callers decide how to
 * show that using `sunAltitude`.
 */
export function moonTrack(
  place: Place,
  isoDate: string,
  year: number,
  scenario: Scenario,
  stepMinutes = 60,
): MoonSample[] {
  const track: MoonSample[] = [];
  for (let minute = 0; minute < 1440; minute += stepMinutes) {
    const state = moonAt(place, isoDate, year, scenario, minute);
    if (state.altitude <= 0) continue;
    track.push({
      ...state,
      clockMinute: minute,
      sunAltitude: sunAltitude(place, isoDate, year, scenario, minute),
    });
  }
  return track;
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
