import tzlookup from "tz-lookup";
import type { Place } from "../types";

type CityRow = readonly [string, string, number, number];
type ZipRow = readonly [string, string, string, number, number];

export interface LocationResult extends Place {
  kind: "city" | "zip";
}

const normalize = (value: string) => value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
const loadCities = () => import("../data/us-cities.generated");
const loadZips = () => import("../data/us-zips.generated");

const cityToPlace = (row: CityRow): LocationResult => {
  const [city, state, latitude, longitude] = row;
  return { id: `city:${city}:${state}`, city, state, latitude, longitude, timezone: tzlookup(latitude, longitude), kind: "city" };
};

const zipToPlace = (row: ZipRow): LocationResult => {
  const [zip, city, state, latitude, longitude] = row;
  return { id: `zip:${zip}`, city, state, zip, latitude, longitude, timezone: tzlookup(latitude, longitude), kind: "zip" };
};

export const defaultPlace: Place = {
  id: "city:Washington:DC",
  city: "Washington",
  state: "DC",
  latitude: 38.9072,
  longitude: -77.0369,
  timezone: "America/New_York",
};

export async function searchLocations(rawQuery: string, limit = 8): Promise<LocationResult[]> {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];
  const numeric = query.replace(/\s/g, "");
  if (/^\d{2,5}$/.test(numeric)) {
    const { zipRows } = await loadZips();
    return zipRows.filter(([zip]) => zip.startsWith(numeric)).slice(0, limit).map(zipToPlace);
  }

  const { cityRows } = await loadCities();
  const stateMatch = query.match(/(?:^|\s)([a-z]{2})$/);
  const requestedState = stateMatch?.[1].toUpperCase();
  const cityQuery = requestedState ? query.slice(0, -2).trim() : query;
  return cityRows
    .map((row) => ({ row, normalized: normalize(row[0]) }))
    .filter(({ row, normalized }) => normalized.includes(cityQuery) && (!requestedState || row[1] === requestedState))
    .sort((a, b) => {
      const aStarts = a.normalized.startsWith(cityQuery) ? 0 : 1;
      const bStarts = b.normalized.startsWith(cityQuery) ? 0 : 1;
      return aStarts - bStarts || a.normalized.length - b.normalized.length || a.normalized.localeCompare(b.normalized);
    })
    .slice(0, limit)
    .map(({ row }) => cityToPlace(row));
}

export async function nearestPlace(latitude: number, longitude: number): Promise<Place> {
  const { cityRows } = await loadCities();
  let best: CityRow = cityRows[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  const latScale = Math.cos((latitude * Math.PI) / 180);
  for (const row of cityRows) {
    const distance = (row[2] - latitude) ** 2 + ((row[3] - longitude) * latScale) ** 2;
    if (distance < bestDistance) { best = row; bestDistance = distance; }
  }
  return cityToPlace(best);
}

export function serializePlace(place: Place): string {
  return [place.id, place.city, place.state, place.zip ?? "", place.latitude, place.longitude, place.timezone].join("|");
}

export function deserializePlace(value: string): Place | null {
  const [id, city, state, zip, lat, lng, timezone] = value.split("|");
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!id || !city || !state || !timezone || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { id, city, state, zip: zip || undefined, latitude, longitude, timezone };
}

export function placeLabel(place: Place): string {
  return `${place.city}, ${place.state}${place.zip ? ` ${place.zip}` : ""}`;
}
