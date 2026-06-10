# letterboxd Changelog

## [Switch search to TMDB] - 2026-06-09

- Letterboxd put its search behind a Cloudflare managed challenge, so the scraping-based search returned "no results" for every query (e.g. "Hirayasumi", "Perfect Days").
- Reworked the command to search via TMDB (Letterboxd's own data source) with live search-as-you-type, and to deep-link movies into their Letterboxd film page (`/tmdb/<id>/`) and shows into Letterboxd search.
- Requires a free TMDB API key (see README).

## [Fix] - 2026-04-23

- Fixed the issue with the rating histogram not working

## [Fix] - 2026-04-06

- Fixed genre tag color for better visibility in light mode

## [Maintenance] - 2026-02-07

- Add support for Windows platform
- Bump all dependencies to the latest
- Update to use fetch instead of got

## [Fix search movies not working] - 2025-09-15

- Fix the issue with the search movies not working
- Fix the issue with the movie details not displaying data

## [Fix show movie details not working] - 2025-08-04

- Fix the issue with the movie details not working

## [Add movie runtime information] - 2025-04-10

- Add runtime information to the movie details panel

## [Fix the issue with the emoji substring] - 2024-11-01

- Fix the issue with the review content emoji substring that causes an error

## [Fix search movie not working] - 2024-10-04

- Fix the issue with the movie search not working

## [Initial Version] - 2024-02-01

- Can search for movies and view details about them
