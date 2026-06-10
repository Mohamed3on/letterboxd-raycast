import { getPreferenceValues } from "@raycast/api";
import { showFailureToast, useFetch } from "@raycast/utils";
import { useMemo } from "react";

/** A movie or show, normalized from TMDB into the only shape the UI needs. */
export interface Title {
  id: number;
  kind: "film" | "show";
  name: string;
  originalName?: string;
  year?: string;
  rating?: number;
  posterUrl?: string;
}

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

// The only place that knows how TMDB is authed: a v3 key in the query string, or a v4 Read Access
// Token (a JWT) as a bearer header.
function tmdbRequest(path: string, extra: Record<string, string> = {}): { url: string; headers?: Record<string, string> } {
  const key = getPreferenceValues<{ tmdbApiKey: string }>().tmdbApiKey.trim();
  const isBearer = key.split(".").length === 3;
  const params = new URLSearchParams({ language: "en-US", ...extra });
  if (!isBearer) params.set("api_key", key);
  return {
    url: `https://api.themoviedb.org/3${path}?${params.toString()}`,
    headers: isBearer ? { Authorization: `Bearer ${key}` } : undefined,
  };
}

interface RawResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
}

function toTitle(raw: RawResult): Title {
  return {
    id: raw.id,
    kind: raw.media_type === "movie" ? "film" : "show",
    name: raw.title ?? raw.name ?? "Untitled",
    originalName: raw.original_title ?? raw.original_name,
    year: (raw.release_date ?? raw.first_air_date ?? "").slice(0, 4) || undefined,
    rating: raw.vote_average || undefined,
    posterUrl: raw.poster_path ? `${POSTER_BASE}${raw.poster_path}` : undefined,
  };
}

// Relevancy: exact title match → films before shows → higher rating → newer year. Stable, so TMDB's
// own order breaks remaining ties. Ranks the raw payload so vote_count can discount unrated noise.
function rank(results: RawResult[], query: string): RawResult[] {
  const q = query.trim().toLowerCase();
  const titleOf = (r: RawResult) => (r.title ?? r.name ?? "").toLowerCase();
  const originalOf = (r: RawResult) => (r.original_title ?? r.original_name ?? "").toLowerCase();
  const isExact = (r: RawResult) => titleOf(r) === q || originalOf(r) === q;
  const yearOf = (r: RawResult) => Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || 0;
  const ratingOf = (r: RawResult) => (r.vote_count && r.vote_count > 0 ? (r.vote_average ?? 0) : 0);

  return [...results].sort((a, b) => {
    const exact = Number(isExact(b)) - Number(isExact(a));
    if (exact) return exact;
    const film = Number(b.media_type === "movie") - Number(a.media_type === "movie");
    if (film) return film;
    if (ratingOf(b) !== ratingOf(a)) return ratingOf(b) - ratingOf(a);
    return yearOf(b) - yearOf(a);
  });
}

/** Search movies + shows, returning ranked, normalized Titles. */
export function useTitleSearch(query: string): { titles: Title[]; isLoading: boolean } {
  const { url, headers } = tmdbRequest("/search/multi", { query, include_adult: "false" });
  const { data, isLoading } = useFetch<{ results?: RawResult[] }>(url, {
    execute: query.trim().length > 0,
    keepPreviousData: true,
    headers,
    onError: (error) => {
      showFailureToast(error, { title: "TMDB request failed (check your API key)" });
    },
  });

  const titles = useMemo(() => {
    const found = (data?.results ?? []).filter((r) => r.media_type === "movie" || r.media_type === "tv");
    return rank(found, query).map(toTitle);
  }, [data, query]);

  return { titles, isLoading };
}

const tmdbType = (title: Title) => (title.kind === "film" ? "movie" : "tv");

/** Where a Title opens: a film's Letterboxd page, or a show on IMDb (Letterboxd has no tmdb-TV link). */
export async function destinationFor(title: Title): Promise<string> {
  if (title.kind === "film") return `https://letterboxd.com/tmdb/${title.id}/`;
  const { url, headers } = tmdbRequest(`/tv/${title.id}/external_ids`);
  const response = await fetch(url, { headers });
  const { imdb_id } = (await response.json()) as { imdb_id?: string | null };
  return imdb_id
    ? `https://www.imdb.com/title/${imdb_id}/`
    : `https://www.imdb.com/find/?q=${encodeURIComponent(title.name)}&s=tt`;
}

export const tmdbPageUrl = (title: Title) => `https://www.themoviedb.org/${tmdbType(title)}/${title.id}`;

export const letterboxdSearchUrl = (title: Title) =>
  `https://letterboxd.com/search/films/${encodeURIComponent(title.name)}/`;

/** Sync URL for copy/share: a film's Letterboxd page, or the TMDB page for a show. */
export const shareUrl = (title: Title) =>
  title.kind === "film" ? `https://letterboxd.com/tmdb/${title.id}/` : tmdbPageUrl(title);
