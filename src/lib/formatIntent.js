// Plain "issues" and "vol." are deliberately not signals: "the issues where
// Robin dies" and "Batman vol. 2" say nothing about how the reader buys comics.
// Neither is "absolute", which is also a line of ongoing series.
const COLLECTED = /\b(trades?|tpbs?|paperbacks?|hardcovers?|omnibus(es)?|compendiums?|collected|collections?|editions?|deluxe|graphic novels?)\b/i;
const ISSUES = /\b(single[\s-]issues?|singles|floppies|individual issues?|issue[\s-]by[\s-]issue)\b/i;

// Words that name a format rather than a story, so callers can keep them out
// of title searches.
export const FORMAT_WORDS = [
  'trade', 'trades', 'tpb', 'tpbs', 'paperback', 'paperbacks', 'hardcover', 'hardcovers',
  'omnibus', 'omnibuses', 'compendium', 'compendiums', 'collected', 'collection', 'collections',
  'edition', 'editions', 'deluxe', 'graphic', 'novel', 'novels',
  'single', 'singles', 'floppies', 'individual', 'issue', 'issues',
];

// Which format a free-text request names: 'collected', 'issues', or null when
// it names neither or both.
export function detectFormat(prompt) {
  const text = prompt || '';
  const collected = COLLECTED.test(text);
  const issues = ISSUES.test(text);
  if (collected === issues) return null;
  return collected ? 'collected' : 'issues';
}
