# What If DST?

An interactive, neutral explainer for comparing sunrise and sunset under current US clock rules, the hypothetical full-year effect of the Sunshine Protection Act of 2025, and permanent standard time.

## Features

- Search US cities and ZIP codes without a runtime geocoding API.
- Compare up to four locations using local clock time.
- Toggle sunrise, sunset, civil twilight, policies, locations, and every individual line.
- Choose a rolling ±10-year range.
- Add schedule markers and compare days spent before sunrise or after sunset.
- Share the complete state in the URL and remember it locally.
- Export a chart PNG or daily CSV.
- Read neutral policy context, methodology, limitations, and primary sources.
- Switch between a dark theme, a light theme, and the system setting.

## Interface

The interface uses Tailwind CSS v4 with shadcn-style components built on Radix primitives in `src/components/ui`. Design tokens live in `src/index.css` as OKLCH custom properties, with a light ramp on `:root` and a dark ramp on `.dark`.

Chart colors are the one exception. They are concrete hex values in `src/lib/chart-theme.ts`, because Recharts writes them into SVG attributes and the PNG export clones the chart into a document where `var(--…)` does not resolve. Legend and tooltip swatches read the same palette.

The font is self-hosted. The page makes no third-party request.

## Local development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Run verification:

```sh
npm test
npm run build
```

## Cloudflare Workers

The application is entirely static and deploys through Cloudflare Workers Static Assets. It needs no server function, database, environment variable, or runtime API key.

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 22

For direct upload after authenticating Wrangler:

```sh
npm run deploy
```

Cloudflare Web Analytics can be enabled from the Cloudflare dashboard; no analytics snippet is included in the source.

## Location data

`npm run generate:locations` builds separate lazy-loaded city and ZIP indexes from the BSD-licensed [`zipcodes`](https://www.npmjs.com/package/zipcodes) package. The generated files are committed so production builds do not depend on an external data service.

City results use the average coordinates of the city’s ZIP records. ZIP results use the dataset coordinate. Military mail regions are excluded; the 50 states, District of Columbia, and US territories present in the source remain available.
