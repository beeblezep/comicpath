import { useState } from 'react';
import { fetchComicGuide } from './lib/api';
import { useReadingList } from './hooks/useReadingList';
import { useAlreadyRead } from './hooks/useAlreadyRead';
import { usePathBuilder } from './hooks/usePathBuilder';
import { SearchBar } from './components/SearchBar';
import { ResultsView } from './components/ResultsView';
import { ReadingListPanel } from './components/ReadingListPanel';
import { PathBuilder } from './components/PathBuilder';

const VIEW = { SEARCH: 'search', LOADING: 'loading', RESULTS: 'results', ERROR: 'error', BUILDER: 'builder' };

export default function App() {
  const [view, setView] = useState(VIEW.SEARCH);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [builderQuery, setBuilderQuery] = useState('');
  const readingList = useReadingList();
  const alreadyRead = useAlreadyRead();
  const pathBuilder = usePathBuilder();

  async function handleSearch(query, mode) {
    setView(VIEW.LOADING);
    setError(null);
    try {
      const result = await fetchComicGuide(query, mode);
      setData(result);
      setView(VIEW.RESULTS);
    } catch (err) {
      setError(err.message);
      setView(VIEW.ERROR);
    }
  }

  function handleBuildPath(query) {
    setBuilderQuery(query);
    setView(VIEW.BUILDER);
  }

  function handleReset() {
    setView(VIEW.SEARCH);
    setData(null);
    setBuilderQuery('');
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
              background: 'var(--color-canon)',
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
          onBuildPath={handleBuildPath}
          loading={view === VIEW.LOADING}
          hasSavedPath={pathBuilder.hasSavedPath}
        />
      )}

      {view === VIEW.LOADING && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-muted)', fontSize: '13px' }}>
          Building your reading guide...
        </div>
      )}

      {view === VIEW.RESULTS && data && (
        <ResultsView data={data} readingList={readingList} alreadyRead={alreadyRead} onReset={handleReset} />
      )}

      {view === VIEW.BUILDER && (
        <PathBuilder
          readingList={readingList}
          alreadyRead={alreadyRead}
          onReset={handleReset}
          initialQuery={builderQuery}
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
