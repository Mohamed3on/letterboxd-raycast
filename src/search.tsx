import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  List,
  closeMainWindow,
  getPreferenceValues,
  getSelectedText,
  open,
  popToRoot,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import { destinationFor, letterboxdSearchUrl, shareUrl, tmdbPageUrl, useTitleSearch, type Title } from "./catalog";

interface Preferences {
  autoOpenSelected: boolean;
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const { autoOpenSelected } = getPreferenceValues<Preferences>();

  // When launched from a selection (with auto-open on) we hide the search UI behind a brief loader
  // and jump straight to the result, so it feels like a direct action rather than "a search opened".
  const [autoOpening, setAutoOpening] = useState(autoOpenSelected);
  const selectedQueryRef = useRef<string | null>(null);
  const autoOpenedRef = useRef(false);

  // Prefill the search bar with the text highlighted in the frontmost app, so you can just select a
  // title and run the command. Needs Raycast's Accessibility permission; ignored if nothing is selected.
  useEffect(() => {
    getSelectedText()
      .then((selected) => {
        const trimmed = selected?.replace(/\s+/g, " ").trim();
        if (trimmed) {
          selectedQueryRef.current = trimmed;
          setSearchText(trimmed);
          setQuery(trimmed);
        } else {
          setAutoOpening(false); // no selection → go straight to the normal search list
        }
      })
      .catch(() => setAutoOpening(false));
  }, []);

  // Debounce the query that drives the request so typing stays responsive.
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(searchText), 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

  const { titles, isLoading } = useTitleSearch(query);

  // Open a Title, then reset to the root search with a cleared bar — clears the input after opening
  // and guarantees the next launch starts fresh, so a new selection always wins.
  async function openTitle(title: Title) {
    try {
      await open(await destinationFor(title));
      await closeMainWindow();
      await popToRoot({ clearSearchBar: true });
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't open" });
    }
  }

  // When launched from a text selection, jump straight to the top result (only while the query still
  // matches that selection, i.e. the user hasn't started typing something else).
  useEffect(() => {
    if (!autoOpening || autoOpenedRef.current) return;
    if (!selectedQueryRef.current || query !== selectedQueryRef.current) return;
    if (isLoading) return;
    if (titles.length === 0) {
      setAutoOpening(false); // nothing to open — fall back to the search list to refine
      return;
    }
    autoOpenedRef.current = true;
    void openTitle(titles[0]);
  }, [autoOpening, isLoading, query, titles]);

  if (autoOpening) {
    return <Detail isLoading markdown={selectedQueryRef.current ? `Opening **${selectedQueryRef.current}**…` : ""} />;
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search for a movie or show…"
    >
      {titles.length === 0 ? (
        <List.EmptyView
          icon={Icon.FilmStrip}
          title={query.trim().length === 0 ? "Search Letterboxd" : "No results found"}
          description={query.trim().length === 0 ? "Start typing a movie or show title." : "Try a different title."}
        />
      ) : (
        titles.map((title) => {
          const accessories: List.Item.Accessory[] = [];
          if (title.kind === "show") accessories.push({ tag: "TV" });
          if (title.rating) accessories.push({ text: title.rating.toFixed(1), icon: Icon.Star });

          return (
            <List.Item
              key={`${title.kind}-${title.id}`}
              icon={title.posterUrl ? { source: title.posterUrl } : Icon.FilmStrip}
              title={title.name}
              subtitle={[title.year, title.originalName !== title.name ? title.originalName : undefined]
                .filter(Boolean)
                .join("  ·  ")}
              accessories={accessories}
              actions={
                <ActionPanel>
                  <Action
                    title={title.kind === "show" ? "Open on IMDb" : "Open on Letterboxd"}
                    icon={Icon.Globe}
                    onAction={() => openTitle(title)}
                  />
                  <Action.OpenInBrowser title="Open on TMDB" url={tmdbPageUrl(title)} />
                  {title.kind === "show" && (
                    <Action.OpenInBrowser title="Search on Letterboxd" url={letterboxdSearchUrl(title)} />
                  )}
                  <Action.CopyToClipboard
                    title="Copy Link"
                    content={shareUrl(title)}
                    shortcut={{ modifiers: ["cmd"], key: "." }}
                  />
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
