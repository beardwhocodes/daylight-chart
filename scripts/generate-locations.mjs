import { createRequire } from "node:module";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { codes } = require("zipcodes");
const excludedMilitaryRegions = new Set(["AA", "AE", "AP"]);

const zips = Object.values(codes)
  .filter((place) => place.country === "US" && !excludedMilitaryRegions.has(place.state) && Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
  .map((place) => [place.zip, place.city, place.state, place.latitude, place.longitude]);

const cityGroups = new Map();
for (const [, city, state, latitude, longitude] of zips) {
  const key = `${city.toLocaleLowerCase("en-US")}|${state}`;
  const group = cityGroups.get(key) ?? { city, state, latitude: 0, longitude: 0, count: 0 };
  group.latitude += latitude;
  group.longitude += longitude;
  group.count += 1;
  cityGroups.set(key, group);
}

const cities = [...cityGroups.values()]
  .map(({ city, state, latitude, longitude, count }) => [
    city,
    state,
    Number((latitude / count).toFixed(4)),
    Number((longitude / count).toFixed(4)),
  ])
  .sort((a, b) => `${a[1]} ${a[0]}`.localeCompare(`${b[1]} ${b[0]}`));

const cityOutput = `// Generated from the zipcodes npm dataset. Run npm run generate:locations to refresh.\ntype CityRow = readonly [string, string, number, number];\nexport const cityRows: readonly CityRow[] = ${JSON.stringify(cities)};\n`;
const zipOutput = `// Generated from the zipcodes npm dataset. Run npm run generate:locations to refresh.\ntype ZipRow = readonly [string, string, string, number, number];\nexport const zipRows: readonly ZipRow[] = ${JSON.stringify(zips)};\n`;

await Promise.all([
  writeFile(resolve("src/data/us-cities.generated.ts"), cityOutput),
  writeFile(resolve("src/data/us-zips.generated.ts"), zipOutput),
  rm(resolve("src/data/us-locations.generated.ts"), { force: true }),
]);
console.log(`Generated ${cities.length} cities and ${zips.length} ZIP codes.`);
