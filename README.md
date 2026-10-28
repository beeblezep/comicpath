# ComicPath

An AI-native comic book reading guide. Search any character, team, or series and get a ranked, categorized reading guide built by Claude.

## Getting started

```bash
npm install
npm run dev
```

## API key setup

The app calls the Anthropic API from the browser. For local development, add your key to `.env.local` (git-ignored):

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Then pass it as `x-api-key` in `src/lib/api.js`. In production, route requests through a backend proxy so the key is never exposed client-side.

## Project structure

```
src/
  App.jsx                    Top-level state & view routing
  components/
    SearchBar.jsx            Search input + quick picks
    ResultsView.jsx          Character header + story sections
    StorySection.jsx         Grouped story category with label
    StoryCard.jsx            Individual story — expandable, saveable
    ReadingListPanel.jsx     Slide-in saved-items sidebar
  hooks/
    useReadingList.js        Persisted reading list (localStorage)
  lib/
    api.js                   Anthropic API client + prompt builder
  styles/
    global.css               CSS custom properties + reset
```

## Title categories

Every title gets exactly one category (defined in `src/lib/model.js`):

| Color  | Category  | Meaning                                            |
|--------|-----------|----------------------------------------------------|
| Purple | Essential | Must read — canon for this path                    |
| Amber  | Optional  | Might read — worth reading, alternate or Elseworlds |
| Gray   | Skip      | Not needed — safe to pass on                       |

A reading path holds one or more seeds — a character, a group, or a story arc —
and each title records which seed(s) it belongs to; crossovers list several.

## Roadmap

- [ ] Comics API integration (Marvel API, Comic Vine) with AI cross-checking
- [ ] Timeline visualization
- [ ] Reading order / sequenced view
- [ ] Cover image thumbnails
- [ ] Reading progress tracker
- [ ] Backend proxy for API key security
- [ ] Design system pass
