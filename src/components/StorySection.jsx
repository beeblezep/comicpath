import { StoryCard } from './StoryCard';
import { categoryMeta, slugify } from '../lib/model';

export function StorySection({ category, stories, character, readingList }) {
  if (!stories?.length) return null;
  const { label, desc, color } = categoryMeta(category);

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
        <span style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)' }}>{desc}</span>
        <span style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)' }}>
          {stories.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {stories.map((story) => {
          return (
            <StoryCard
              key={story.id}
              story={story}
              character={character}
              isSaved={readingList.has(slugify(story.title))}
              onToggleSave={readingList.toggle}
            />
          );
        })}
      </div>
    </section>
  );
}
