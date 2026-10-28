import { categoryMeta } from '../../lib/model';

export function CategoryTag({ category }) {
  return <span className={`cat-tag cat-${category}`}>{categoryMeta(category).label}</span>;
}
