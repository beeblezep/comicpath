import { StoryCard } from './StoryCard';

const SECTION_META = {
  canon:     { label: 'Canon & Essential',      color: 'var(--color-canon)'     },
  secondary: { label: 'Worth Reading',           color: 'var(--color-secondary)' },
  elseworld: { label: 'Elseworlds & Alternates', color: 'var(--color-elseworld)' },
  skip:      { label: 'You Can Skip',            color: 'var(--color-skip)'      },
};

export function StorySection({ type, stories, character, readingList }) {
  if (!stories?.length) return null;
  const { label, color } = SECTION_META[type] ?? { label: type, color: 'var(--color-muted)' };

  return (
    <section style={{ marginBottom: 'var(--space-xl)' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-md)' }}>
        <span
          style={{
            display: 'inline-block',
            width: 10, height: 10,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{label}</span>
        <span style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)' }}>
          {stories.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {stories.map((story, i) => {
          const itemId = `${character}-${story.title}`.replace(/\s+/g, '-').toLowerCase();
          return (
            <StoryCard
              key={i}
              story={story}
              type={type}
              character={character}
              isSaved={readingList.has(itemId)}
              onToggleSave={readingList.toggle}
            />
          );
        })}
      </div>
    </section>
  );
}
