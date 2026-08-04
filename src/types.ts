export type EventType = "sunrise" | "sunset" | "dawn" | "dusk";
export type Scenario = "current" | "permanentDst" | "permanentStandard";

export interface Place {
  id: string;
  city: string;
  state: string;
  zip?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface DaylightPoint {
  day: number;
  isoDate: string;
  dateLabel: string;
  [seriesKey: string]: number | string | null;
}

export interface SeriesDefinition {
  key: string;
  placeId: string;
  placeIndex: number;
  event: EventType;
  scenario: Scenario;
  label: string;
}

export interface ScheduleMarker {
  id: string;
  label: string;
  time: string;
  kind: "morning" | "evening";
}

export interface AppSettings {
  places: Place[];
  year: number;
  events: EventType[];
  scenarios: Scenario[];
  hiddenSeries: string[];
  markers: ScheduleMarker[];
  use24Hour: boolean;
}
