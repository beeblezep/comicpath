import { useState, useEffect } from 'react';
import { EDGE_LABELS, categoryMeta, isCrossover, nodeSeeds, slugify } from '../../lib/model';

/**
 * The details drawer: chips (category, path step, seed), cover and synopsis,
 * facts, Read before / Read after (each opens that title), and actions.
 */
export function TitleDetails({
  node, seeds, chips, before, after, byId, action, readingList, alreadyRead, subject,
  expandable, expanding, onOpen, onClose, onExpand,
}) {
  const [refinement, setRefinement] = useState('');
  useEffect(() => { setRefinement(''); }, [node.id]);

  const slug = slugify(node.title);
  const isSaved = readingList.has(slug);
  const isRead = alreadyRead.isRead(slug);
  const ownSeeds = nodeSeeds(node, seeds);
  const facts = [
    { label: 'Published', value: node.year },
    { label: 'Issues', value: node.issues },
    { label: node.edition ? 'Edition' : 'Format', value: node.edition || node.format },
    { label: ownSeeds.length > 1 ? 'Seeds' : 'Seed', value: ownSeeds.map((s) => s.name).join(', ') },
  ].filter((f) => f.value);

  const linkList = (items, label, empty) => (items.length === 0
    ? <div className="details-empty">{empty}</div>
    : items.map((r) => (
      <button key={r.id} type="button" className="details-link" onClick={() => onOpen(r.id)}>
        <span className="details-link-title">{byId.get(r.id)?.title}</span>
        <span className="details-link-label">{r.kinds.includes('rec') ? label : `${label} · optional`}</span>
      </button>
    )));

  return (
    <aside className="details" aria-label="Title details" onClick={(e) => e.stopPropagation()}>
      <div className="details-head">
        <div className="details-kicker">
          Title details
          <button type="button" className="icon-btn" aria-label="Close details" onClick={onClose}>×</button>
        </div>
        <h2 className="details-title">{node.title}</h2>
        <div className="details-chips">
          <span className={`chip is-${node.category}`}>{categoryMeta(node.category).label}</span>
          {chips.map((c) => <span key={c.text} className={`chip${c.path ? ' is-path' : ''}`}>{c.text}</span>)}
          {ownSeeds.length === 1 && <span className="chip">{ownSeeds[0].name}</span>}
          {isCrossover(node) && <span className="chip">Crossover · {ownSeeds.map((s) => s.name).join(' + ')}</span>}
        </div>
      </div>

      <div className="details-body">
        <div className="details-section">
          <div className="details-cover">[Cover image]</div>
          <p className="details-synopsis">{node.why || '[Synopsis]'}</p>
        </div>
        {facts.length > 0 && (
          <dl className="details-facts">
            {facts.map((f) => (
              <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
            ))}
          </dl>
        )}
        {node.collects?.length > 0 && (
          <section className="details-section">
            <h3>Collects</h3>
            {node.collects.map((c, i) => (
              <div key={i} className="details-link-label">{[c.issues, c.story].filter(Boolean).join(' · ')}</div>
            ))}
          </section>
        )}
        <section className="details-section">
          <h3>Read before</h3>
          {linkList(before, EDGE_LABELS.before, 'Nothing needs to come first.')}
        </section>
        <section className="details-section">
          <h3>Read after</h3>
          {linkList(after, EDGE_LABELS.after, 'Nothing follows on from this title.')}
        </section>
        {onExpand && (
          <section className="details-section">
            <h3>Expand from here</h3>
            <textarea
              className="details-refine"
              rows={2}
              value={refinement}
              disabled={expanding}
              onChange={(e) => setRefinement(e.target.value)}
              placeholder="Optional: e.g. focus on crossover events"
            />
            <button
              type="button"
              className="details-btn"
              disabled={expanding}
              onClick={() => { onExpand(node.id, refinement); setRefinement(''); }}
            >
              {expanding ? 'Expanding…' : expandable ? '+ Expand' : '+ Expand again'}
            </button>
          </section>
        )}
      </div>

      <div className="details-foot">
        <a
          className="details-btn is-primary"
          href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(node.title)}`}
          target="_blank"
          rel="noreferrer"
        >
          Open title
        </a>
        <button
          type="button"
          className={`details-btn${isSaved ? ' is-on' : ''}`}
          aria-pressed={isSaved}
          onClick={() => readingList.toggle({ id: slug, title: node.title, category: node.category, format: node.issues || '', subject })}
        >
          {isSaved ? '★ Saved' : 'Save'}
        </button>
        <button
          type="button"
          className={`details-btn${isRead ? ' is-on' : ''}`}
          aria-pressed={isRead}
          onClick={() => alreadyRead.toggleRead(slug)}
        >
          {isRead ? '✓ Read' : 'Mark read'}
        </button>
        {action && (
          <button type="button" className="details-btn is-action" onClick={action.go}>{action.label}</button>
        )}
      </div>
    </aside>
  );
}
