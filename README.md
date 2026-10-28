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
    PathView.jsx             Canvas + chat drawer for the current path
    Constellation*.jsx       Canvas, nodes, edges, detail panel, chat, toolbar
    ReadingListPanel.jsx     Slide-in saved-items sidebar
  hooks/
    useIntent.js             Prompt → seeds + mode, with clarifying questions
    usePathBuilder.js        Persisted current path (localStorage)
    useReadingList.js        Persisted reading list (localStorage)
    useAlreadyRead.js        Persisted read marks (localStorage)
    usePromptHistory.js      Chat history for the session
  lib/
    model.js                 Seeds, categories, graph shape
    api.js                   LLM client, prompts, parsing
    comicvine.js             ComicVine lookups
    graphMerge.js            Merging chat expansions into the path
    constellationLayout.js   Canvas layout
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
On the canvas each seed gets its own column (ringed anchor node), and a crossover
sits between its seeds with a link to each of them.

## Roadmap

- [ ] Comics API integration (Marvel API, Comic Vine) with AI cross-checking
- [ ] Timeline visualization
- [ ] Reading order / sequenced view
- [ ] Cover image thumbnails
- [ ] Reading progress tracker
- [ ] Backend proxy for API key security
- [ ] Design system pass
