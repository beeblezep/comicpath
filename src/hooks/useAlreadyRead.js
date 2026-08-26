import { useState, useEffect } from 'react';

const STORAGE_KEY = 'comicpath_already_read';

export function useAlreadyRead() {
  const [readIds, setReadIds] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds]));
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
