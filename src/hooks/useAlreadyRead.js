import { useState, useEffect } from 'react';
import { GRAPH_VERSION } from '../lib/model';

const STORAGE_KEY = 'comicpath_already_read';

// Ids are slugify(title). Older saves used other slug formats, so they're dropped.
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.v === GRAPH_VERSION && Array.isArray(parsed.ids)) return new Set(parsed.ids);
    if (raw) localStorage.removeItem(STORAGE_KEY);
    return new Set();
  } catch {
    return new Set();
  }
}

export function useAlreadyRead() {
  const [readIds, setReadIds] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: GRAPH_VERSION, ids: [...readIds] }));
  }, [readIds]);

  function markRead(id) {
    setReadIds((prev) => new Set(prev).add(id));
  }

  function unmarkRead(id) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleRead(id) {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isRead(id) {
    return readIds.has(id);
  }

  return { readIds, markRead, unmarkRead, toggleRead, isRead };
}
