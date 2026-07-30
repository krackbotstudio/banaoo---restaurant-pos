import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchLocations, type LocationSearchHit } from "@/lib/geocoding";
import { cn } from "@/lib/utils";

interface LocationSearchInputProps {
  onSelect: (hit: LocationSearchHit) => void;
  placeholder?: string;
  className?: string;
  /** Optional country filter, e.g. "in". Omit for worldwide. */
  countrycodes?: string;
}

export function LocationSearchInput({
  onSelect,
  placeholder = "Search any place worldwide…",
  className,
  countrycodes,
}: LocationSearchInputProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const runSearch = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const hits = await searchLocations(trimmed, { limit: 8, countrycodes });
      if (requestId !== requestIdRef.current) return;
      setResults(hits);
      setSearched(true);
      setOpen(true);
      setActiveIndex(hits.length > 0 ? 0 : -1);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setSearched(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      void runSearch(value);
    }, 450);
  };

  const selectHit = (hit: LocationSearchHit) => {
    onSelect(hit);
    setQuery(hit.displayName);
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
  };

  const clear = () => {
    requestIdRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    setQuery("");
    setResults([]);
    setOpen(false);
    setLoading(false);
    setSearched(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || (searched && query.trim().length >= 3)) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
              void runSearch(query);
              return;
            }
            if (e.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              selectHit(results[activeIndex]);
            }
          }}
          placeholder={placeholder}
          className="h-11 pl-9 pr-9"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={clear}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {open && (loading || searched || results.length > 0) && (
        <div
          id={listId}
          role="listbox"
          className="mt-2 max-h-56 overflow-auto border border-border bg-background"
        >
          {loading && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Searching locations…</p>
          ) : results.length === 0 && searched ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No matches found. Try a fuller address, landmark, or city.
            </p>
          ) : (
            results.map((hit, index) => (
              <button
                key={hit.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "flex w-full items-start gap-2 border-b border-border/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60",
                  index === activeIndex && "bg-primary/10"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectHit(hit)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug text-foreground">
                    {hit.displayName}
                  </span>
                  {hit.subtitle ? (
                    <span className="mt-0.5 block text-xs capitalize text-muted-foreground">
                      {hit.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        Type at least 3 characters, then pick a result to drop the pin exactly.
      </p>
    </div>
  );
}
