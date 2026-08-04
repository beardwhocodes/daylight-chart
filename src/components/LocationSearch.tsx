import { ChevronDown, LoaderCircle, LocateFixed, MapPin, Plus, X } from "lucide-react";
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
  /** Swap one chosen place for another, keeping its slot and its colour. */
  onReplace: (id: string, place: Place) => void;
  onRemove: (id: string) => void;
}

const MAX_PLACES = 4;
/** Which search is open: adding a new place, or replacing the one with this id. */
const ADDING = "add";

export function LocationSearch({ places, onAdd, onReplace, onRemove }: Props) {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const [query, setQuery] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);
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

  /** Each search closes and clears itself, so the next one opens empty. */
  const openSearch = (target: string | null) => {
    setQuery("");
    setOpenFor(target);
  };

  const choose = (place: Place, replacing: string | null) => {
    if (replacing) onReplace(replacing, place);
    else onAdd(place);
    openSearch(null);
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
        choose(await nearestPlace(coords.latitude, coords.longitude), null);
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

  /**
   * The same list serves both jobs. When replacing, the place being swapped out
   * is not treated as already chosen — picking it again is a harmless no-op,
   * and marking it "Added" would look like the row was broken.
   */
  const searchPanel = (replacing: string | null) => (
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
                  const taken = places.some(
                    (selected) => selected.id === place.id && selected.id !== replacing,
                  );
                  return (
                    <CommandItem
                      key={place.id}
                      value={place.id}
                      disabled={taken}
                      onSelect={() => !taken && choose(place, replacing)}
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
                      {taken && <span className="text-muted-foreground ml-auto text-xs">Added</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </PopoverContent>
  );

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
            className="h-8 gap-0 rounded-lg py-0 pr-1 pl-0 text-[13px]"
          >
            {/* The chip itself changes the place. Adding a second city then
                deleting the first was the only way to switch, which read as a
                comparison tool rather than a picker. */}
            <Popover
              open={openFor === place.id}
              onOpenChange={(next) => openSearch(next ? place.id : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Change ${placeLabel(place)}`}
                  className="hover:bg-foreground/10 -my-px flex h-8 min-w-0 items-center gap-2 rounded-lg py-0 pr-1.5 pl-2.5 transition-colors"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: placeSwatch(palette, index) }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{placeLabel(place)}</span>
                  <ChevronDown className="size-3 shrink-0 opacity-50" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              {searchPanel(place.id)}
            </Popover>

            {places.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(place.id)}
                aria-label={`Remove ${placeLabel(place)}`}
                className="hover:bg-foreground/10 grid size-6 shrink-0 place-items-center rounded-md transition-colors"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </Badge>
        ))}

        {!atLimit && (
          <>
            <Popover
              open={openFor === ADDING}
              onOpenChange={(next) => openSearch(next ? ADDING : null)}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-dashed"
                  aria-label="Compare another US city or ZIP code"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Compare another
                </Button>
              </PopoverTrigger>
              {searchPanel(null)}
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
