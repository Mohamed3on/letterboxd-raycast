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
import { guessTitle, typesafeKey } from "./jev";

interface Preferences {
  autoOpenSelected: boolean;
  typesafeApiKey?: string;
}

const itemId = (title: Title) => `${title.kind}-${title.id}`;

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [preselectedId, setPreselectedId] = useState<string>();
  const { autoOpenSelected, typesafeApiKey } = getPreferenceValues<Preferences>();

  // When launched from a selection (with auto-open on) we hide the search UI behind a brief loader
  // and jump straight to the result, so it feels like a direct action rather than "a search opened".
  const [autoOpening, setAutoOpening] = useState(autoOpenSelected);
  const selectedQueryRef = useRef<string | null>(null);
  const autoOpenedRef = useRef(false);
  // Closed while Jev was deciding: its late answer mustn't open anything.
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

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

  const { titles, exact, isLoading } = useTitleSearch(query);

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
    if (exact) return void openTitle(titles[0]);
    // No title is exactly the selection: Jev picks the one it names, behind the same loader. A sure pick
    // opens; a clear lead shows the list with it preselected, so Enter opens it; anything else shows the
    // list. Without Jev (no key, slow, failed), the top result opens as before.
    void guessTitle(titles, query, typesafeKey(typesafeApiKey)).then((guess) => {
      if (closedRef.current) return;
      if (guess === undefined) return openTitle(titles[0]);
      if (guess?.sure) return openTitle(guess.title);
      if (guess) setPreselectedId(itemId(guess.title));
      setAutoOpening(false);
    });
  }, [autoOpening, exact, isLoading, query, titles]);

  if (autoOpening) {
    return <Detail isLoading markdown={selectedQueryRef.current ? `Opening **${selectedQueryRef.current}**…` : ""} />;
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search for a movie or show…"
      selectedItemId={query === selectedQueryRef.current ? preselectedId : undefined}
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
              key={itemId(title)}
              id={itemId(title)}
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
