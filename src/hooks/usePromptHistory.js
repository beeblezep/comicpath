import { useState, useCallback, useRef } from 'react';

// In-memory only: history lasts for the page session and is not persisted.
// Entry kinds:
//   'clarify' — the search that started the path: { prompt, answers[{question, answer}], status, note?, added?, error? }
//   'expand'  — a chat or drawer expansion: { prompt, nodeIds, nodeTitles, source, format, status, added?, note?, error? }
export function usePromptHistory() {
  const [entries, setEntries] = useState([]);
  const counter = useRef(0);

  const add = useCallback((entry) => {
    const id = `h${++counter.current}`;
    setEntries((prev) => [...prev, { ...entry, id, at: Date.now() }]);
    return id;
  }, []);

  const update = useCallback((id, patch) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const remove = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, add, update, remove, clear };
}
