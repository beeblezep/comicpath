const BASE = '/api/comicvine';

async function cvFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`ComicVine ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.error !== 'OK' && json.status_code !== 1) {
    throw new Error(`ComicVine error: ${json.error}`);
  }
  return json;
}

async function searchCharacter(query) {
  const params = new URLSearchParams({
    query,
    resources: 'character',
    limit: '5',
    field_list: 'id,name,deck,publisher,first_appeared_in_issue,image',
  });
  const json = await cvFetch(`/search/?${params}`);
  return (json.results || []).map((c) => ({
    id: c.id,
    name: c.name,
    deck: c.deck,
    publisher: c.publisher?.name ?? null,
    firstIssue: c.first_appeared_in_issue?.name ?? null,
    image: c.image?.small_url ?? null,
  }));
}

async function getCharacterDetails(id) {
  const fields = [
    'id', 'name', 'deck', 'description', 'publisher',
    'first_appeared_in_issue', 'volume_credits', 'story_arc_credits',
  ].join(',');
  const json = await cvFetch(`/character/4005-${id}/?field_list=${fields}`);
  const r = json.results;
  return {
    id: r.id,
    name: r.name,
    deck: r.deck,
    publisher: r.publisher?.name ?? null,
    firstIssue: r.first_appeared_in_issue?.name ?? null,
    volumes: (r.volume_credits || []).slice(0, 20).map((v) => ({
      id: v.id,
      name: v.name,
    })),
    storyArcs: (r.story_arc_credits || []).slice(0, 15).map((a) => ({
      id: a.id,
      name: a.name,
    })),
  };
}

async function getVolumeDetails(ids) {
  const capped = ids.slice(0, 10);
  const results = await Promise.all(
    capped.map(async (id) => {
      try {
        const fields = 'id,name,deck,start_year,count_of_issues,publisher';
        const json = await cvFetch(`/volume/4050-${id}/?field_list=${fields}`);
        const v = json.results;
        return {
          id: v.id,
          name: v.name,
          deck: v.deck,
          startYear: v.start_year,
          issueCount: v.count_of_issues,
          publisher: v.publisher?.name ?? null,
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

async function getStoryArcDetails(ids) {
  const capped = ids.slice(0, 8);
  const results = await Promise.all(
    capped.map(async (id) => {
      try {
        const fields = 'id,name,deck,publisher';
        const json = await cvFetch(`/story_arc/4045-${id}/?field_list=${fields}`);
        const a = json.results;
        return {
          id: a.id,
          name: a.name,
          deck: a.deck,
          publisher: a.publisher?.name ?? null,
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

const ALTERNATE_MARKERS = [
  'tangent', 'earth-2', 'earth-3', 'earth 2', 'earth 3',
  'alternate', 'elseworld', 'amalgam', 'antimatter',
  'crime syndicate', 'red son', 'injustice', 'flashpoint',
  'kingdom come', 'dark multiverse', 'earth-x', 'earth x',
  'ultraverse', 'wildstorm', 'ultimate universe',
];

function scoreCharacterCandidate(character, query) {
  let score = 0;
  const deckLower = (character.deck || '').toLowerCase();
  const nameLower = (character.name || '').toLowerCase();
  const queryLower = query.toLowerCase();

  for (const marker of ALTERNATE_MARKERS) {
    if (deckLower.includes(marker)) { score -= 20; break; }
  }

  const pub = (character.publisher || '').toLowerCase();
  if (pub === 'dc comics' || pub === 'marvel') score += 10;

  if (nameLower === queryLower) score += 15;
  else if (nameLower.startsWith(queryLower)) score += 5;

  for (const marker of ALTERNATE_MARKERS) {
    if (queryLower.includes(marker)) { score += 25; break; }
  }

  return score;
}

export async function searchComicVine(query) {
  const characters = await searchCharacter(query);
  if (characters.length === 0) return null;

  const best = characters
    .map((c) => ({ ...c, _score: scoreCharacterCandidate(c, query) }))
    .sort((a, b) => b._score - a._score)[0];
  const details = await getCharacterDetails(best.id);

  const [volumes, arcs] = await Promise.all([
    getVolumeDetails(details.volumes.map((v) => v.id)),
    getStoryArcDetails(details.storyArcs.map((a) => a.id)),
  ]);

  return {
    character: {
      name: details.name,
      publisher: details.publisher,
      deck: details.deck,
      firstIssue: details.firstIssue,
    },
    volumes,
    storyArcs: arcs,
  };
}
