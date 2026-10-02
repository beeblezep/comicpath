import { useState, useCallback, useRef } from 'react';

// In-memory only: history lasts for the page session and is not persisted.
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

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, add, update, clear };
}
