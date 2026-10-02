# Letterboxd for Raycast

Quickly search for a movie or show and open it on Letterboxd, straight from Raycast.

Highlight a title in any app and run the command — it prefills from your selection and (optionally) jumps straight to the top match. When no result's title is exactly the selection ("Heat 1995", "Amelie", "The Office US"), [TypeSafe](https://typesafe.ai)'s Jev picks the one it names first, and opens it only when sure; otherwise the list shows, with its best guess selected when one clearly leads. Optional: set the **TypeSafe API Key** preference, or `TYPESAFE_API_KEY` in `~/.config/typesafe/env`.

## Why TMDB?

Letterboxd has no public search API, and it now serves its search/AJAX endpoints behind a
Cloudflare "managed challenge" that blocks any non-browser HTTP client (the original scraping
approach silently returns "no results" for every query). Search is therefore powered by
**TMDB** — the same data source Letterboxd itself uses — and results link straight out:

- **Movies** open their Letterboxd film page via `letterboxd.com/tmdb/<id>/`.
- **Shows** open **IMDb** (Letterboxd has no TMDB-based deep link for TV), with a "Search on Letterboxd" fallback action.

## Install

Not on the Raycast Store — run it as a local extension:

```bash
git clone https://github.com/Mohamed3on/letterboxd-raycast.git
cd letterboxd-raycast
npm install
npm run dev   # imports it into Raycast; you can quit this afterwards and it stays installed
```

## Setup

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/).
2. Go to **Settings → API** and copy your **API Key (v3 auth)** (a v4 Read Access Token also works).
3. Paste it into the extension's **TMDB API Key** preference on first run.

## Credit

Based on the original [Letterboxd extension](https://github.com/raycast/extensions/tree/main/extensions/letterboxd)
by **rafael_garcia**; rebuilt on TMDB after Letterboxd put its search behind Cloudflare. MIT.
