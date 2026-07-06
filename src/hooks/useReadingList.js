import { useState, useEffect } from 'react';

const STORAGE_KEY = 'comicpath_reading_list';

/**
 * Persisted reading list state.
 * Each item: { id, title, type, format, character }
 */
export function useReadingList() {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
