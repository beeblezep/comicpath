import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchPath } from './lib/api';
import { useReadingList } from './hooks/useReadingList';
import { useAlreadyRead } from './hooks/useAlreadyRead';
import { usePathBuilder } from './hooks/usePathBuilder';
import { usePromptHistory } from './hooks/usePromptHistory';
import { useIntent } from './hooks/useIntent';
import { SearchBar } from './components/SearchBar';
import { ReadingListPanel } from './components/ReadingListPanel';
import { PathView } from './components/PathView';

const VIEW = { SEARCH: 'search', MAP: 'map' };

export default function App() {
  const [view, setView] = useState(VIEW.SEARCH);
  const [panelOpen, setPanelOpen] = useState(false);
  // The resolved request whose path is being fetched, and its error if that failed.
  const [building, setBuilding] = useState(null);
  const [buildError, setBuildError] = useState(null);
  const readingList = useReadingList();
  const alreadyRead = useAlreadyRead();
  const pathBuilder = usePathBuilder();
  const promptHistory = usePromptHistory();
  const { start: startPath } = pathBuilder;
  const { add: addHistory, update: updateHistory, clear: clearHistory } = promptHistory;

  // The chat entry tracking the current search, and the request being built
  // (so a reply to a cancelled or replaced request is ignored).
  const searchEntry = useRef(null);
  const buildRef = useRef(null);

  const buildPath = useCallback(async (resolved) => {
    buildRef.current = resolved;
    setBuilding(resolved);
    setBuildError(null);
    updateHistory(searchEntry.current, { status: 'loading', error: null });
    try {
      const { graph } = await fetchPath({ query: resolved.prompt, seeds: resolved.seeds, mode: resolved.mode });
      if (buildRef.current !== resolved) return;
      startPath(graph);
      updateHistory(searchEntry.current, { status: 'done', note: graph.note, added: graph.nodes.length });
      setBuilding(null);
    } catch (err) {
      if (buildRef.current !== resolved) return;
      const msg = err.message || 'Something went wrong.';
      setBuildError(msg);
      updateHistory(searchEntry.current, { status: 'error', error: msg });
    }
  }, [startPath, updateHistory]);
  const intent = useIntent(buildPath);

  // Mirror the clarifying exchange into the search's chat entry.
  useEffect(() => {
    if (!searchEntry.current || intent.status === 'idle') return;
    updateHistory(searchEntry.current, { status: intent.status, answers: intent.answers, error: intent.error });
  }, [intent.status, intent.answers, intent.error, updateHistory]);

  function stopBuilding() {
    buildRef.current = null;
    setBuilding(null);
    setBuildError(null);
  }

  function handleSearch(query) {
    stopBuilding();
    clearHistory();
    searchEntry.current = addHistory({ kind: 'clarify', prompt: query, answers: [], status: 'resolving' });
    intent.start(query);
    setView(VIEW.MAP);
  }

  function handleReset() {
    intent.cancel();
    stopBuilding();
    setView(VIEW.SEARCH);
  }

  // What the canvas and chat need while a search is still in progress.
  const searchStatus = intent.status !== 'idle' ? intent.status
    : building ? (buildError ? 'error' : 'loading')
    : null;
  const search = searchStatus && {
    status: searchStatus,
    prompt: intent.prompt || building?.prompt || '',
    question: intent.status === 'clarifying' ? intent.question : null,
    onAnswer: intent.answer,
    onCancel: handleReset,
    onRetry: intent.status === 'error' ? intent.retry : () => buildPath(building),
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* App bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky', top: 0, zIndex: 5,
        background: 'var(--color-bg)',
      }}>
        <button
          onClick={handleReset}
          style={{
            background: 'none', border: 'none',
            color: 'var(--color-text)',
            fontWeight: 700, fontSize: 17,
            letterSpacing: 1,
          }}
        >
          ComicPath
        </button>

        <button
          onClick={() => setPanelOpen(true)}
          style={{
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 20,
            color: 'var(--color-muted)',
            padding: '6px 14px',
            fontSize: '13px',
            display: 'flex', gap: 6, alignItems: 'center',
          }}
        >
          Saved
          {readingList.items.length > 0 && (
            <span style={{
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 10,
              fontSize: 10,
              padding: '1px 6px',
              fontWeight: 600,
            }}>
              {readingList.items.length}
            </span>
          )}
        </button>
      </header>

      {view === VIEW.SEARCH && (
        <SearchBar
          onSearch={handleSearch}
          onResume={() => setView(VIEW.MAP)}
          savedTitle={pathBuilder.hasSavedPath ? pathBuilder.title : null}
        />
      )}

      {view === VIEW.MAP && (
        <PathView
          pathBuilder={pathBuilder}
          readingList={readingList}
          alreadyRead={alreadyRead}
          onReset={handleReset}
          history={promptHistory}
          search={search}
        />
      )}

      <ReadingListPanel
        items={readingList.items}
        onRemove={readingList.remove}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}
