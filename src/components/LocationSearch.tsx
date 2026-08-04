import { LoaderCircle, LocateFixed, MapPin, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FieldLabel } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chartPalette, placeSwatch } from "@/lib/chart-theme";
import { nearestPlace, placeLabel, searchLocations } from "@/lib/locations";
import { useTheme } from "@/hooks/useTheme";
import type { LocationResult } from "@/lib/locations";
import type { Place } from "@/types";

interface Props {
  places: Place[];
  onAdd: (place: Place) => void;
  onRemove: (id: string) => void;
}

const MAX_PLACES = 4;

export function LocationSearch({ places, onAdd, onRemove }: Props) {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchLocations(query).then((matches) => {
        if (cancelled) return;
        setResults(matches);
        setSearching(false);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const add = (place: Place) => {
    onAdd(place);
    setQuery("");
    setOpen(false);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        add(await nearestPlace(coords.latitude, coords.longitude));
        setLocating(false);
      },
      () => {
        setError("We couldn't access your location. Search for your city or ZIP instead.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const atLimit = places.length >= MAX_PLACES;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <FieldLabel>Locations</FieldLabel>
        <span className="text-muted-foreground/70 tabular text-[10px]">
          {places.length}/{MAX_PLACES}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Selected locations">
        {places.map((place, index) => (
          <Badge
            key={place.id}
            variant="secondary"
            className="h-8 gap-2 rounded-lg py-0 pr-1 pl-2.5 text-[13px]"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: placeSwatch(palette, index) }}
              aria-hidden="true"
            />
            <span className="truncate">{placeLabel(place)}</span>
            {places.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(place.id)}
                aria-label={`Remove ${placeLabel(place)}`}
                className="hover:bg-foreground/10 -mr-0.5 grid size-6 shrink-0 place-items-center rounded-md transition-colors"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </Badge>
        ))}

        {!atLimit && (
          <>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-dashed"
                  aria-label="Add a US city or ZIP code"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add location
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
                {/* Results are fetched, not filtered client-side, so cmdk must not re-filter. */}
                <Command shouldFilter={false}>
                  <CommandInput
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search a city or ZIP code…"
                  />
                  <CommandList>
                    {query.trim().length < 2 ? (
                      <div className="text-muted-foreground px-3 py-8 text-center text-sm">
                        Type at least two characters.
                      </div>
                    ) : searching ? (
                      <div className="text-muted-foreground flex items-center justify-center gap-2 px-3 py-8 text-sm">
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        Searching…
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>No matching US city or ZIP code.</CommandEmpty>
                        <CommandGroup>
                          {results.map((place) => {
                            const alreadyAdded = places.some((selected) => selected.id === place.id);
                            return (
                              <CommandItem
                                key={place.id}
                                value={place.id}
                                disabled={alreadyAdded}
                                onSelect={() => !alreadyAdded && add(place)}
                              >
                                <MapPin className="text-muted-foreground" aria-hidden="true" />
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate font-medium">
                                    {place.city}, {place.state}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {place.zip ? `ZIP ${place.zip}` : "City center"}
                                  </span>
                                </span>
                                {alreadyAdded && (
                                  <span className="text-muted-foreground ml-auto text-xs">Added</span>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-8"
              onClick={locate}
              disabled={locating}
            >
              {locating ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed className="size-3.5" aria-hidden="true" />
              )}
              {locating ? "Locating…" : "Use my location"}
            </Button>
          </>
        )}
      </div>

      {atLimit && (
        <p className="text-muted-foreground text-xs">
          Comparison limit of {MAX_PLACES} locations reached.
        </p>
      )}
      {error && (
        <p className="text-destructive text-xs" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
