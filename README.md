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

## Story categories

| Color  | Category               | Meaning                                      |
|--------|------------------------|----------------------------------------------|
| Purple | Canon & Essential      | Must-read; core to understanding the character |
| Amber  | Worth Reading          | Good stories for fans who want more          |
| Coral  | Elseworlds & Alternates | Fun what-ifs; not required                  |
| Gray   | You Can Skip           | Low value; completionist fodder              |

## Roadmap

- [ ] Comics API integration (Marvel API, Comic Vine) with AI cross-checking
- [ ] Timeline visualization
- [ ] Reading order / sequenced view
- [ ] Cover image thumbnails
- [ ] Reading progress tracker
- [ ] Backend proxy for API key security
- [ ] Design system pass
