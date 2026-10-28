import { useState, useEffect } from 'react';
import { GRAPH_VERSION } from '../lib/model';

const STORAGE_KEY = 'comicpath_reading_list';

// Lists saved before the 3-category model are dropped, not migrated.
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.v === GRAPH_VERSION && Array.isArray(parsed.items)) return parsed.items;
    if (raw) localStorage.removeItem(STORAGE_KEY);
    return [];
  } catch {
    return [];
  }
}

/**
 * Persisted reading list state.
 * Each item: { id, title, category, format, subject }
 */
export function useReadingList() {
  const [items, setItems] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: GRAPH_VERSION, items }));
  }, [items]);

  function add(item) {
    setItems(prev => {
      if (prev.some(x => x.id === item.id)) return prev;
      return [...prev, item];
    });
  }

  function remove(id) {
    setItems(prev => prev.filter(x => x.id !== id));
  }

  function toggle(item) {
    if (items.some(x => x.id === item.id)) remove(item.id);
    else add(item);
  }

  function has(id) {
    return items.some(x => x.id === id);
  }

  return { items, add, remove, toggle, has };
}
