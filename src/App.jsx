import { useState, useCallback } from 'react';
import { fetchPath } from './lib/api';
import { useReadingList } from './hooks/useReadingList';
import { useAlreadyRead } from './hooks/useAlreadyRead';
import { usePathBuilder } from './hooks/usePathBuilder';
import { usePromptHistory } from './hooks/usePromptHistory';
import { useIntent } from './hooks/useIntent';
import { SearchBar } from './components/SearchBar';
import { ClarifyQuestion } from './components/ClarifyQuestion';
import { ReadingListPanel } from './components/ReadingListPanel';
import { PathView } from './components/PathView';

const VIEW = { SEARCH: 'search', LOADING: 'loading', MAP: 'map', ERROR: 'error' };

export default function App() {
  const [view, setView] = useState(VIEW.SEARCH);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const readingList = useReadingList();
  const alreadyRead = useAlreadyRead();
  const pathBuilder = usePathBuilder();
  const promptHistory = usePromptHistory();
  const { start: startPath } = pathBuilder;
  const { clear: clearHistory } = promptHistory;

  const handleResolved = useCallback(async ({ prompt, seeds, mode }) => {
    setView(VIEW.LOADING);
    setError(null);
    try {
      const { graph } = await fetchPath({ query: prompt, seeds, mode });
      startPath(graph);
      clearHistory();
      setView(VIEW.MAP);
    } catch (err) {
      setError(err.message);
      setView(VIEW.ERROR);
    }
  }, [startPath, clearHistory]);
  const intent = useIntent(handleResolved);

  function handleSearch(query) {
    setError(null);
    intent.start(query);
  }

  function handleReset() {
    intent.cancel();
    setView(VIEW.SEARCH);
  }

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

      {(view === VIEW.SEARCH || view === VIEW.LOADING) && (
        <SearchBar
          onSearch={handleSearch}
          onResume={() => setView(VIEW.MAP)}
          loading={view === VIEW.LOADING || intent.status === 'resolving'}
          savedTitle={pathBuilder.hasSavedPath ? pathBuilder.title : null}
        />
      )}

      {view === VIEW.SEARCH && intent.status !== 'idle' && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px 20px' }}>
          {intent.status === 'resolving' && (
            <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>
              {intent.answers.length ? 'Got it…' : 'Working out what you\'re after…'}
            </p>
          )}
          {intent.status === 'clarifying' && (
            <ClarifyQuestion question={intent.question} onAnswer={intent.answer} onCancel={intent.cancel} />
          )}
          {intent.status === 'error' && (
            <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>
              {intent.error}{' '}
              <button onClick={intent.cancel} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 13, padding: 0 }}>
                Dismiss
              </button>
            </p>
          )}
        </div>
      )}

      {view === VIEW.LOADING && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-muted)', fontSize: '13px' }}>
          Building your reading path...
        </div>
      )}

      {view === VIEW.MAP && (
        <PathView
          pathBuilder={pathBuilder}
          readingList={readingList}
          alreadyRead={alreadyRead}
          onReset={handleReset}
          history={promptHistory}
        />
      )}

      {view === VIEW.ERROR && (
        <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-muted)', marginBottom: 16 }}>{error ?? 'Something went wrong.'}</p>
          <button
            onClick={handleReset}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              padding: '8px 18px',
              fontSize: '13px',
            }}
          >
            ← Try again
          </button>
        </div>
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
