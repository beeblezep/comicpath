# ComicPath

An AI-native comic book reading guide. Ask for any character, team, or story arc and get a categorized reading path built by Claude.

## Getting started

```bash
npm install
npm run dev
```

## API key setup

API calls go through serverless proxies in `api/` (Claude, with Groq as a
fallback, and ComicVine), so keys stay server-side. For local development put
`ANTHROPIC_API_KEY`, `GROQ_API_KEY` and `COMICVINE_API_KEY` in `.env`; the Vite
dev server runs the same proxies.

## How a search works

One free-text prompt ("catch me up on Absolute Power") is resolved into seeds
and a mode (Full guide / Catch up / Deep dive). If the entity, the seed
structure, or the mode is unclear, ComicPath asks one multiple-choice question
at a time. Searching opens the canvas straight away: the questions are asked in
its chat drawer, and the path appears on the canvas once they're answered. The
same drawer is then used for expanding the path.

## Project structure

```
src/
  App.jsx                    Top-level state & view switching
  components/
    SearchBar.jsx            Single search input + example prompts
    ClarifyQuestion.jsx      Multiple-choice clarifying question + "Other"
    PathView.jsx             Map + chat drawer for the current path
    ChatDrawer.jsx           Chat drawer: clarifying questions, expansions
    map/                     The map: MetroMap, TitleCard, SeedRegion, Connector,
                             PathLine, PathPill, Legend, TitleDetails, ReadingView
    ReadingListPanel.jsx     Slide-in saved-items sidebar
  hooks/
    useIntent.js             Prompt → seeds + mode, with clarifying questions
    usePathBuilder.js        Persisted current path (localStorage)
    useReadingList.js        Persisted reading list (localStorage)
    useAlreadyRead.js        Persisted read marks (localStorage)
    usePromptHistory.js      Chat history for the session
    useMapState.js           Selection, traced/pinned paths, skips & adds (saved per path)
  lib/
    model.js                 Seeds, categories, graph shape
    api.js                   LLM client, prompts, parsing
    comicvine.js             ComicVine lookups
    graphMerge.js            Merging chat expansions into the path
    readingPaths.js          Reading-path logic: visible titles, skips, order, summaries
    metroLayout.js           Deterministic map layout and line routing
  styles/
    global.css               CSS custom properties + reset
    map.css                  All map styles (lo-fi wireframe; --map-* tokens)
```

## Title categories

Every title gets exactly one category (defined in `src/lib/model.js`):

| Tag       | Meaning                                            |
|-----------|----------------------------------------------------|
| Essential | Must read — canon for this path                    |
| Optional  | Might read — worth reading, alternate or Elseworlds |
| Skip      | Not needed — safe to pass on (hidden unless "Show skipped titles") |

A reading path holds one or more seeds — a character, a group, or a story arc —
and each title records which seed(s) it belongs to; crossovers list several.

## The map

- Each seed is a tinted region; titles shared by two seeds sit in a crossover
  region between them.
- Solid arrows mean "read first", dashed arrows "enhances, optional", and no line
  means a standalone story.
- The AI also returns 1-3 reading paths (A, B…), drawn as metro lines. Hover a
  line or its pill to trace it, click to pin it, and use "Continue with Path B"
  to read on. − skips a title (the line routes around it), + adds an optional
  title, and Reset restores the suggested route. Your changes are saved per path.
- The Reading view lists the pinned paths in order; ⓘ opens a title's details.

## Roadmap

- [ ] Comics API integration (Marvel API, Comic Vine) with AI cross-checking
- [ ] Timeline visualization
- [ ] Reading order / sequenced view
- [ ] Cover image thumbnails
- [ ] Reading progress tracker
- [ ] Backend proxy for API key security
- [ ] Design system pass
