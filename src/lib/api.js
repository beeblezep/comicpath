/* ============================================================
   ComicPath — API client (Claude LLM with Groq fallback + ComicVine enrichment)
   ============================================================ */

import { searchComicVineSmartly, searchVolumes, searchStoryArcs, getVolumeIssues } from './comicvine.js';
import { FORMAT_WORDS } from './formatIntent.js';
import {
  GRAPH_VERSION, EDGE_TYPES, PATH_IDS, edgeKind, linkSeeds, normalizeCategory, normalizeSeedType, normalizeTitle, resolveSeedIds,
} from './model.js';

const CLAUDE_URL = '/api/claude';
const GROQ_URL = '/api/groq/openai/v1/chat/completions';

async function callClaude(prompt) {
  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${body.error || response.statusText}`);
  if (!body.text) throw new Error('empty response');
  return body.text;
}

async function callGroq(prompt, maxTokens) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.error?.message || response.statusText;
    throw new Error(`API error ${response.status}: ${msg}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// Claude is preferred; Groq answers when Claude is not configured or fails.
async function callLLM(prompt, groqMaxTokens) {
  try {
    return await callClaude(prompt);
  } catch (err) {
    console.warn('Claude unavailable, falling back to Groq:', err.message);
    return callGroq(prompt, groqMaxTokens);
  }
}

/* ── Disambiguation rules ─────────────────────────────────── */
const DISAMBIGUATION_RULES = `
CONTINUITY RULES:
- Default to mainstream continuity (DC: Prime Earth, Marvel: 616) unless the query names an alternate (e.g. "Ultimate Spider-Man").
- Alternate-continuity and Elseworlds stories are always category "optional" — never "essential".
- For ambiguous mantles (e.g. "Flash"), default to the most iconic version; mention others in the note.
- If an alternate is explicitly requested, treat it as primary; don't mix continuities.
`;

const CATEGORY_RULE = '- category: essential = must read, canon for this path; optional = worth reading, alternate or Elseworlds; skip = not needed, safe to pass on.';

const SEED_RULE = `- seeds: what the reader is reading about. Usually exactly one. type is "character" for one character, "group" for a team or for characters read together (list them in "members"), "arc" for a story arc, event or series.
- A group seed covers titles where its members appear together. Separate seeds cover titles for each one individually, plus crossovers where they appear together.
- Each node's "seeds" lists the names of the seeds it features (exactly as written in "seeds"). A crossover lists every seed it involves.`;

const PATH_RULE = `- paths: 1-3 reading paths, each a list of node titles in reading order (exact titles). Path 1 is the main recommended route through the essential titles. Add a second path only for a distinct line worth reading in order, e.g. the second seed's own run or a major event and its lead-up; it may start partway, from a title not on path 1. Every path is built on essential titles; put optional titles in a path only at the point they would be read (the reader chooses whether to add them) — never make a path of optional titles alone. Never put skip titles in a path. Every essential title should be on a path.`;

const MODE_INSTRUCTIONS = {
  full: '10-15 nodes spanning the publication history from origin to present. Use "leads-to" edges for the main chronological path. Branch off with "branches-from" for optional side stories, "crossover" for event tie-ins. Weight the most iconic stories 4-5, moderate ones 3, minor tie-ins 1-2.',
  'catch-up': '6-10 nodes starting from a recent good entry point to get the reader current. Mostly "leads-to" and "prerequisite" edges. Weight the entry point and destination highest (4-5). Only truly essential tie-ins.',
  'deep-dive': '8-12 nodes showing the prerequisites and lead-up to the most relevant current or recent arc, favouring the more obscure good stuff. Use "prerequisite" edges for required reading, "crossover" for event tie-ins, "branches-from" for depth stories. Weight the target arc node 5.',
};

function buildCvBlock(cvData) {
  let contextBlock = '';
  const queryType = cvData?.queryType || 'character';

  if (cvData) {
    if (queryType === 'character') {
      const c = cvData.character;
      const volList = cvData.volumes
        .map((v) => `  - ${v.name} (${v.startYear || '?'}, ${v.issueCount || '?'} issues)${v.deck ? ': ' + v.deck : ''}`)
        .join('\n');
      const arcList = cvData.storyArcs
        .map((a) => `  - ${a.name}${a.deck ? ': ' + a.deck : ''}`)
        .join('\n');

      const charLines = [`Character: ${c.name}`];
      if (c.publisher) charLines.push(`Publisher: ${c.publisher}`);
      if (c.firstIssue) charLines.push(`First appearance: ${c.firstIssue}`);
      if (c.deck) charLines.push(`Bio: ${c.deck}`);

      contextBlock = `
VERIFIED DATA from ComicVine (use this as your primary source — prefer these real titles, years, and issue counts over your training data):

${charLines.join('\n')}

Known volumes/series:
${volList || '  (none found)'}

Known story arcs:
${arcList || '  (none found)'}

IMPORTANT: Base your recommendations on the real volumes and arcs listed above. Use accurate issue numbers, years, and titles. You may supplement with your own knowledge for descriptions and ordering, but titles and issue data must match real publications.
`;
    } else {
      const target = cvData.target;
      contextBlock = `
VERIFIED DATA from ComicVine — the reader wants to read a SPECIFIC title:

Target title: ${target.name}
${target.publisher ? `Publisher: ${target.publisher}` : ''}
${target.deck ? `Description: ${target.deck}` : ''}
${target.startYear ? `Year: ${target.startYear}` : ''}
${target.issueCount ? `Issues: ${target.issueCount}` : ''}

The reader wants to catch up on recent events and context LEADING UP TO this title. Make this title an "arc" seed and a node (weight 5) that the graph builds toward. Include prerequisite stories, related arcs, and crossover events that provide essential context.

IMPORTANT: Use your knowledge of this title's continuity to recommend real titles with accurate issue numbers, years, and titles.
`;
    }
  }
  return contextBlock;
}

function buildPrompt(query, cvDatas, mode = 'full', seeds = []) {
  const contextBlock = cvDatas.map(buildCvBlock).join('');
  const seedBlock = seeds.length
    ? `\nThe request has been resolved to these seeds. Use exactly these in "seeds" (same names, types and members):\n${seeds.map((s) => `- ${s.name} (${s.type}${s.members?.length ? `: ${s.members.join(', ')}` : ''})`).join('\n')}\n`
    : '';

  return `You are ComicPath, an expert comic book guide for new and returning readers.

A reader searched for: "${query}"
${seedBlock}${contextBlock}
${DISAMBIGUATION_RULES}
Return ONLY a JSON object — no markdown, no preamble, no trailing text.

Structure:
{
  "character": { "name": "", "initials": "XX", "publisher": "", "firstAppearance": "YYYY", "description": "2-3 sentences.", "tags": [] },
  "seeds": [{ "name": "Batman", "type": "character | group | arc", "members": [] }],
  "aiNote": "1-2 sentence tip.",
  "nodes": [{ "title": "", "year": "YYYY or YYYY-YYYY", "format": "Trade Paperback|Omnibus|Single Issues", "issues": "e.g. Batman #404-407", "why": "One sentence on why this matters.", "category": "essential | optional | skip", "seeds": ["Batman"], "weight": 3, "tags": [], "readFirst": true, "issueList": [{"num":"1","name":"","note":""}] }],
  "edges": [{ "sourceTitle": "exact title of one node", "targetTitle": "exact title of another node", "type": "leads-to | prerequisite | branches-from | crossover", "label": "optional short label" }],
  "paths": [{ "name": "Short name, e.g. Main line", "titles": ["exact title", "exact title"] }],
  "pathNote": "One sentence tip about this reading path."
}

Rules:
- "character" describes what the reader searched for (a character, team or title).
${SEED_RULE}
- nodes: ${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.full}
- Across nodes: 4-6 essential, 3-6 optional (including 2-3 alternate-continuity or Elseworlds stories), 2-3 skip.
${CATEGORY_RULE}
- readFirst: true on the single best starting point only. issueList (3-4 issues) for the top 2 essential nodes only.
- weight: 1-5 (5 = most important).
- Edges connect nodes by exact title. Edge types: leads-to (reading order), prerequisite (required background), branches-from (spin-off/side story), crossover (event tie-in). Skip nodes need no edges.
${PATH_RULE}
- Never use "Unknown" — always provide real values.`;
}

function parseJson(text) {
  const clean = text.replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Response was not valid JSON');
    // Repairs for the slips the model makes in long responses: a trailing
    // comma before } or ], and a key missing its opening quote (`readFirst": true`).
    return JSON.parse(match[0]
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([{,]\s*)([A-Za-z_]\w*)"(\s*:)/g, '$1"$2"$3'));
  }
}

function parseResponse(text, mode, seeds) {
  const data = parseJson(text);
  // Resolved seeds are authoritative; the model only echoes them.
  if (seeds?.length) data.seeds = seeds;
  return validateResponse(data, mode);
}

function validateResponse(data, mode) {
  if (!data.character?.name || data.character.name.toLowerCase() === 'unknown') {
    throw new Error('Invalid response: missing character name');
  }
  if (data.character.publisher?.toLowerCase() === 'unknown') {
    data.character.publisher = null;
  }
  if (data.character.firstAppearance?.toLowerCase() === 'unknown') {
    data.character.firstAppearance = null;
  }

  const graph = validateGraph(data, data.character.name, mode);
  if (!graph.nodes.some((n) => n.category === 'essential' && !n.anchor)) {
    throw new Error('Invalid response: no essential stories returned');
  }

  return {
    character: data.character,
    graph: { ...graph, note: data.aiNote || '' },
  };
}

function normalizeSeeds(rawSeeds, fallbackName) {
  const list = (Array.isArray(rawSeeds) ? rawSeeds : [])
    .filter((s) => s?.name && s.name.toLowerCase() !== 'unknown')
    .slice(0, 6);
  if (list.length === 0) list.push({ name: fallbackName, type: 'character' });
  return list.map((s, i) => ({
    id: `s${i + 1}`,
    name: s.name,
    type: normalizeSeedType(s.type),
    ...(Array.isArray(s.members) && s.members.length > 0 ? { members: s.members.map(String) } : {}),
  }));
}

function normalizeNode(n, id, seeds) {
  return {
    id,
    title: n.title || 'Untitled',
    year: n.year ? String(n.year) : '',
    issues: n.issues || '',
    why: n.why || '',
    category: normalizeCategory(n.category ?? n.tier),
    seedIds: resolveSeedIds(n.seeds, seeds),
    weight: Math.min(5, Math.max(1, Number(n.weight) || 3)),
    tags: Array.isArray(n.tags) ? n.tags : [],
    ...(n.format ? { format: n.format } : {}),
    ...(n.readFirst ? { readFirst: true } : {}),
    ...(Array.isArray(n.issueList) && n.issueList.length > 0 ? { issueList: n.issueList } : {}),
  };
}

// Builds a v2 graph from a guide response: one anchor node per seed (reusing a
// node whose title is the seed, e.g. a story-arc seed), categorized nodes, and
// title-based edges resolved to ids. Nodes left without edges hang off their seed.
function validateGraph(data, fallbackName, mode) {
  const seeds = normalizeSeeds(data.seeds, fallbackName);

  let idCounter = 1;
  const nodes = [];
  const titleToId = new Map();
  for (const raw of (data.nodes || []).slice(0, 20)) {
    if (!raw?.title || raw.title.toLowerCase() === 'unknown') continue;
    const key = normalizeTitle(raw.title);
    if (titleToId.has(key)) continue;
    const node = normalizeNode(raw, `n${idCounter++}`, seeds);
    titleToId.set(key, node.id);
    nodes.push(node);
  }

  for (const seed of seeds) {
    const id = titleToId.get(normalizeTitle(seed.name));
    const existing = id && nodes.find((n) => n.id === id);
    if (existing) {
      Object.assign(existing, { isSeed: true, category: 'essential', seedIds: [seed.id] });
      continue;
    }
    const anchor = {
      id: `n${idCounter++}`,
      title: seed.name,
      year: '',
      issues: '',
      why: '',
      category: 'essential',
      seedIds: [seed.id],
      weight: 5,
      tags: ['seed'],
      isSeed: true,
      anchor: true,
    };
    titleToId.set(normalizeTitle(seed.name), anchor.id);
    nodes.unshift(anchor);
  }

  const edges = [];
  const edgeKeys = new Set();
  for (const e of (data.edges || []).slice(0, 40)) {
    const source = titleToId.get(normalizeTitle(e.sourceTitle));
    const target = titleToId.get(normalizeTitle(e.targetTitle));
    if (!source || !target || source === target) continue;
    if (edgeKeys.has(`${source}->${target}`) || edgeKeys.has(`${target}->${source}`)) continue;
    edgeKeys.add(`${source}->${target}`);
    const type = EDGE_TYPES.includes(e.type) ? e.type : 'leads-to';
    edges.push({ source, target, type, kind: edgeKind(type), label: e.label || '' });
  }

  const linkedEdges = linkSeeds(nodes, edges);
  const connected = new Set(linkedEdges.flatMap((e) => [e.source, e.target]));
  for (const n of nodes) {
    if (n.isSeed || connected.has(n.id)) continue;
    const seedNode = nodes.find((s) => s.isSeed && s.seedIds[0] === n.seedIds[0]);
    if (!seedNode) continue;
    linkedEdges.push({ source: seedNode.id, target: n.id, type: 'branches-from', kind: 'enh', label: '' });
  }

  return {
    v: GRAPH_VERSION,
    id: Date.now().toString(36),
    seeds,
    nodes,
    edges: linkedEdges,
    paths: normalizePaths(data.paths, nodes, titleToId, linkedEdges),
    pathNote: data.pathNote || '',
    mode: MODE_INSTRUCTIONS[mode] ? mode : 'full',
  };
}

// Resolves the model's reading paths (titles) to node ids. Synthetic seed
// anchors and skip titles never sit on a path. Falls back to one path through
// the essential titles if the model gave none usable.
function normalizePaths(rawPaths, nodes, titleToId, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const onPath = (id) => id && !byId.get(id).anchor && byId.get(id).category !== 'skip';
  const paths = [];
  for (const raw of (Array.isArray(rawPaths) ? rawPaths : [])) {
    const ids = [...new Set((raw?.titles || []).map((t) => titleToId.get(normalizeTitle(t))).filter(onPath))];
    // A path with no essential titles would draw nothing until the reader added
    // to it, and one entirely within an earlier path adds nothing.
    if (!ids.some((id) => byId.get(id).category === 'essential') || paths.length === PATH_IDS.length) continue;
    if (ids.every((id) => paths.some((p) => p.nodeIds.includes(id)))) continue;
    const id = PATH_IDS[paths.length];
    paths.push({ id, name: raw.name ? String(raw.name) : `Reading path ${id}`, nodeIds: ids });
  }
  return paths.length > 0 ? paths : [defaultPath(nodes, edges)].filter((p) => p.nodeIds.length > 0);
}

// Essential titles in reading order: follow the solid edges, then by year.
function defaultPath(nodes, edges) {
  const ids = nodes.filter((n) => !n.anchor && n.category === 'essential').map((n) => n.id);
  const inSet = new Set(ids);
  const year = (id) => parseInt(nodes.find((n) => n.id === id)?.year, 10) || 9999;
  const preds = new Map(ids.map((id) => [id, new Set()]));
  for (const e of edges) {
    if (e.kind === 'rec' && inSet.has(e.source) && inSet.has(e.target)) preds.get(e.target).add(e.source);
  }
  const order = [];
  const left = new Set(ids);
  while (left.size > 0) {
    const ready = [...left].filter((id) => [...preds.get(id)].every((p) => !left.has(p)));
    const next = (ready.length > 0 ? ready : [...left]).sort((a, b) => year(a) - year(b))[0];
    order.push(next);
    left.delete(next);
  }
  return { id: 'A', name: 'Reading path A', nodeIds: order };
}

/* ── Related-titles prompt for path builder ──────────────── */

// "The Zoo, Part One" / "The Straw Man: Part 3" / "Abomination, Conclusion" → arc name
function arcNameOf(issueName) {
  return (issueName || '')
    .replace(/[\s,:–-]+(part\s+[\w-]+|conclusion|finale|prologue|epilogue)\b.*$/i, '')
    .trim();
}

function groupIssuesIntoArcs(issues) {
  const arcs = [];
  for (const issue of issues) {
    const name = arcNameOf(issue.name);
    const year = issue.coverDate?.slice(0, 4) || '';
    const last = arcs[arcs.length - 1];
    if (last && name && last.name.toLowerCase() === name.toLowerCase()) {
      last.last = issue.number;
      last.endYear = year || last.endYear;
    } else {
      arcs.push({ name, first: issue.number, last: issue.number, startYear: year, endYear: year });
    }
  }
  return arcs;
}

function buildRequestContextBlock(requestContext) {
  if (!requestContext) return '';
  const { volumes, arcs } = requestContext;
  if (volumes.length === 0 && arcs.length === 0) return '';

  const volLines = volumes.map((v) => {
    const meta = [v.publisher, v.startYear, v.issueCount ? `${v.issueCount} issues` : ''].filter(Boolean).join(', ');
    const head = `  - ${v.name}${meta ? ` (${meta})` : ''}${v.deck?.trim() ? ': ' + v.deck.trim() : ''}`;
    if (!v.issues?.length) return head;
    const arcLines = groupIssuesIntoArcs(v.issues)
      .map((a) => {
        const range = a.first === a.last ? `#${a.first}` : `#${a.first}-${a.last}`;
        const years = a.startYear && a.endYear && a.startYear !== a.endYear ? `${a.startYear}-${a.endYear}` : a.startYear;
        return `      ${range}${a.name ? ` "${a.name}"` : ''}${years ? ` (${years})` : ''}`;
      })
      .join('\n');
    return `${head}\n    Story arcs by issue:\n${arcLines}`;
  });
  const arcLines = arcs.map((a) => `  - ${a.name}${a.publisher ? ` (${a.publisher})` : ''}${a.deck?.trim() ? ': ' + a.deck.trim() : ''}`);

  return `
ComicVine title-search results for the reader's request. These are real publications and may be NEWER than your training data, so trust an entry that matches the request even if you don't recognize it. It is a raw keyword search, though: entries that merely share a word with the request are noise — never return an entry just because it is listed here.
${volLines.length ? `Series:\n${volLines.join('\n')}\n` : ''}${arcLines.length ? `Story arcs:\n${arcLines.join('\n')}\n` : ''}`;
}

function buildSeedBlock(seeds) {
  if (!seeds.length) return '';
  const lines = seeds.map((s) => `- ${s.name} (${s.type}${s.members?.length ? `: ${s.members.join(', ')}` : ''})`);
  return `\nThis reading path is about these seeds:\n${lines.join('\n')}\n`;
}

function buildRelatedTitlesPrompt(titles, cvContexts, existingTitles, refinementPrompt = '', requestContext = null, format = 'issues', seeds = []) {
  const collected = format === 'collected';
  const contextBlock = cvContexts
    .map((ctx, i) => {
      if (!ctx) return '';
      const lines = [`Target: ${ctx.name || titles[i]}`];
      if (ctx.publisher) lines.push(`Publisher: ${ctx.publisher}`);
      if (ctx.startYear) lines.push(`Year: ${ctx.startYear}`);
      if (ctx.issueCount) lines.push(`Issues: ${ctx.issueCount}`);
      if (ctx.deck) lines.push(`Description: ${ctx.deck}`);
      return `\nVERIFIED DATA from ComicVine:\n${lines.join('\n')}\n`;
    })
    .join('');

  const excludeList = existingTitles.length > 0
    ? `\nDo NOT include any of these titles (they are already in the reading path):\n${existingTitles.map((t) => `- ${t}`).join('\n')}\n`
    : '';

  const multi = titles.length > 1;
  const quoted = titles.map((t) => `"${t}"`).join(', ');

  // A refinement request replaces the generic "related titles" task rather than
  // nudging it — otherwise the model just returns the title's best-known stories.
  const refinementBlock = refinementPrompt
    ? `${buildRequestContextBlock(requestContext)}
HOW TO FULFIL THE REQUEST:
- Every title you return must directly satisfy the request "${refinementPrompt}". Do NOT fall back on the generic best-known stories for ${quoted}.
- If the request names a specific series, imprint, line, character, creator, or event, return ${collected ? 'collected editions of it or of stories directly tied to it' : 'story arcs from it or stories directly tied to it'}.
- Start from your own knowledge of what the reader means. Use the ComicVine results only where an entry is clearly the thing they asked for, or to get accurate issue numbers and years.
${collected
    ? '- When the results include a series the reader asked for by name along with its story arcs, return the collected editions of that series in order, using the listed issue ranges and arc names to fill "collects" accurately.'
    : '- When the results include a series the reader asked for by name along with its story arcs, return those arcs: one node per arc, titled "Series Name: Arc Name" with issues like "Series Name #1-6", using the listed issue ranges and years exactly. Cover the arcs in order rather than stopping partway.'}
- If only a few titles genuinely match, return fewer rather than padding with unrelated ones.
`
    : '';

  const baseIntro = refinementPrompt
    ? `A reader is building a reading path around ${multi ? 'these comic titles' : 'the comic title'}: ${quoted}. They asked:\n"${refinementPrompt}"\nSuggest up to 8 titles that fulfil this request.`
    : multi
      ? `Given these comic titles: ${quoted}, suggest 4-8 related titles a reader should know about that are relevant to them. Include direct prequels, sequels, crossovers, and thematically connected stories.`
      : `Given the comic title ${quoted}, suggest 4-8 related titles a reader should know about. Include direct prequels, sequels, crossovers, and thematically connected stories.`;
  const intro = collected
    ? `${baseIntro}\nThe reader reads collected editions, so every title you suggest must be a collected edition.`
    : baseIntro;
  // Applies with or without a request, so it lives in the shared rules.
  const formatRule = collected
    ? `- Return collected editions, not individual stories: each title is ONE real published trade paperback, hardcover, omnibus, or compendium. "title" is the edition's published title, "issues" is the full range it collects, "edition" is its format, and "collects" lists each run of issues inside it with the story it belongs to.
- One edition per story: pick the most widely available English-language edition, and never return two editions that collect the same issues.
`
    : `- Return stories, not editions: never return collected, reprint, deluxe/"Absolute Edition" hardcover, or foreign-language editions as separate titles.
`;
  const editionFields = collected
    ? `,
      "edition": "Trade Paperback | Hardcover | Omnibus | Compendium",
      "collects": [{ "issues": "Batman #404-407", "story": "Year One" }]`
    : '';
  const countRule = refinementPrompt
    ? '- Up to 8 titles, all matching the reader\'s request. Categorize each as essential, optional, or skip.'
    : '- 4-8 related titles. Categorize each as essential, optional, or skip.';
  const edgeRule = multi
    ? `- Edges should connect each related title to one or more of ${quoted} (use their exact titles). Also include edges between related titles where relationships exist.`
    : `- Edges should connect ${quoted} to the related titles. Also include edges between related titles where relationships exist.`;
  // How the request was read belongs to the chat reply, not to any one node:
  // without a field of its own the model writes it into a node's "why".
  const noteField = refinementPrompt
    ? '  "note": "One or two sentences to the reader on how you read their request.",\n'
    : '';
  const noteRule = refinementPrompt
    ? `- "note": address the reader as "you" and say how you interpreted their request and what you added — especially if you guessed at or corrected a title they named.
- "why" describes the story itself. Never mention the reader's request or your interpretation of it in "why"; that goes in "note".
`
    : '';

  return `You are ComicPath, an expert comic book guide.

${intro}
${buildSeedBlock(seeds)}${contextBlock}${excludeList}${refinementBlock}${DISAMBIGUATION_RULES}
Return ONLY a JSON object — no markdown, no preamble, no trailing text.

Structure:
{
${noteField}  "relatedNodes": [
    {
      "title": "${collected ? 'Published title of the collected edition' : 'Story or arc title'}",
      "year": "YYYY or YYYY-YYYY",
      "issues": "e.g. Batman #404-407",
      "why": "One sentence on why this matters.",
      "category": "essential | optional | skip",
      "seeds": ["name of each seed this title features"],
      "weight": 3,
      "tags": ["origin", "crossover", "sequel"]${editionFields}
    }
  ],
  "edges": [
    {
      "sourceTitle": "exact title of one node",
      "targetTitle": "exact title of another node",
      "type": "leads-to | prerequisite | branches-from | crossover",
      "label": "optional short label"
    }
  ]
}

Rules:
${countRule}
- weight: 1-5 (5 = most important).
${edgeRule}
${formatRule}${noteRule}- Use real titles with accurate issue numbers from actual publications.
${CATEGORY_RULE}
${seeds.length ? '- "seeds" lists, by exact name, every seed above that the title features; a crossover lists each one.\n' : ''}- Edge types: leads-to (reading order), prerequisite (required background), branches-from (spin-off/side story), crossover (event tie-in).
- Never use "Unknown" — always provide real values.`;
}

function parseEdition(n) {
  const collects = (Array.isArray(n.collects) ? n.collects : []).slice(0, 20)
    .map((c) => ({ issues: String(c?.issues || ''), story: String(c?.story || '') }))
    .filter((c) => c.issues || c.story);
  const edition = typeof n.edition === 'string' && n.edition.trim() ? n.edition.trim() : 'Collected edition';
  return { edition, collects };
}

function parseRelatedTitlesResponse(text, format = 'issues') {
  const parsed = parseJson(text);

  const nodes = (parsed.relatedNodes || []).slice(0, 10).map((n) => ({
    title: n.title || 'Untitled',
    year: n.year || '',
    issues: n.issues || '',
    why: n.why || '',
    category: normalizeCategory(n.category ?? n.tier),
    seeds: Array.isArray(n.seeds) ? n.seeds.map(String) : [],
    weight: Math.min(5, Math.max(1, Number(n.weight) || 3)),
    tags: Array.isArray(n.tags) ? n.tags : [],
    ...(format === 'collected' ? parseEdition(n) : {}),
  }));

  const edges = (parsed.edges || []).slice(0, 20).map((e) => ({
    sourceTitle: e.sourceTitle || '',
    targetTitle: e.targetTitle || '',
    type: EDGE_TYPES.includes(e.type) ? e.type : 'leads-to',
    label: e.label || '',
  }));

  if (nodes.length === 0) {
    throw new Error('No related titles returned');
  }

  const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';

  return { relatedNodes: nodes, edges, note };
}

async function lookupTitleContext(title) {
  try {
    const [volumes, arcs] = await Promise.all([
      searchVolumes(title).catch(() => []),
      searchStoryArcs(title).catch(() => []),
    ]);
    const match = volumes[0] || arcs[0] || null;
    if (!match) return null;
    return {
      name: match.name,
      publisher: match.publisher?.name || match.publisher || '',
      startYear: match.start_year || match.startYear || '',
      issueCount: match.count_of_issues || match.issueCount || '',
      deck: match.deck || '',
    };
  } catch (err) {
    console.warn('ComicVine lookup failed for related titles:', err.message);
    return null;
  }
}

const REQUEST_FILLER = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'from', 'about', 'some', 'any', 'all',
  'now', 'also', 'please', 'just', 'only', 'more', 'me', 'i', 'want', 'need', 'like',
  'include', 'including', 'add', 'show', 'give', 'find', 'focus', 'expand', 'explore',
  'story', 'stories', 'arc', 'arcs', 'title', 'titles', 'comic', 'comics', 'series', 'related',
  ...FORMAT_WORDS,
]);

// Volumes with more issues than this are long-running series; their first
// issues say little about what the reader asked for, so skip the issue list.
const MAX_ISSUES_FOR_LISTING = 60;

// Looks up what the reader's free-text request refers to, so the model can
// use real (and possibly post-training-cutoff) series and arcs.
async function lookupRequestContext(refinementPrompt) {
  const term = refinementPrompt
    .split(/[^\p{L}\p{N}'&:#.-]+/u)
    .filter((w) => w && !REQUEST_FILLER.has(w.toLowerCase()))
    .join(' ');
  if (!term) return null;

  try {
    const [volumes, arcs] = await Promise.all([
      searchVolumes(term).catch(() => []),
      searchStoryArcs(term).catch(() => []),
    ]);

    // Same-named results are reprints/translations of one series; keep the fullest run.
    const byName = new Map();
    for (const v of volumes) {
      const key = v.name.toLowerCase();
      const kept = byName.get(key);
      if (!kept || (v.issueCount || 0) > (kept.issueCount || 0)) byName.set(key, v);
    }
    const unique = [...byName.values()];

    const listable = unique
      .filter((v) => v.issueCount > 1 && v.issueCount <= MAX_ISSUES_FOR_LISTING)
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 2);
    await Promise.all(listable.map(async (v) => {
      v.issues = await getVolumeIssues(v.id, MAX_ISSUES_FOR_LISTING).catch(() => []);
    }));

    return { volumes: unique, arcs };
  } catch (err) {
    console.warn('ComicVine lookup failed for expansion request:', err.message);
    return null;
  }
}

export async function fetchRelatedTitles(titleOrTitles, existingTitles = [], refinementPrompt = '', format = 'issues', seeds = []) {
  const titles = Array.isArray(titleOrTitles) ? titleOrTitles : [titleOrTitles];
  const [cvContexts, requestContext] = await Promise.all([
    Promise.all(titles.slice(0, 3).map(lookupTitleContext)),
    refinementPrompt ? lookupRequestContext(refinementPrompt) : null,
  ]);

  const text = await callLLM(
    buildRelatedTitlesPrompt(titles, cvContexts, existingTitles, refinementPrompt, requestContext, format, seeds),
    4000,
  );
  return parseRelatedTitlesResponse(text, format);
}

async function lookupSeedContext(seed) {
  try {
    return await searchComicVineSmartly(seed.name, { asTitle: seed.type === 'arc' });
  } catch (err) {
    console.warn(`ComicVine lookup failed for ${seed.name}, falling back to LLM-only:`, err.message);
    return null;
  }
}

// Results for a resolved request: seeds and mode come from resolveIntent.
export async function fetchPath({ query, seeds, mode = 'full' }) {
  const cvDatas = (await Promise.all(seeds.slice(0, 3).map(lookupSeedContext))).filter(Boolean);
  const prompt = buildPrompt(query, cvDatas, mode, seeds);
  try {
    return parseResponse(await callLLM(prompt, 5500), mode, seeds);
  } catch (err) {
    // The model occasionally returns malformed JSON for this long response; one retry.
    if (!(err instanceof SyntaxError) && err.message !== 'Response was not valid JSON') throw err;
    console.warn('Unparseable path response, retrying once:', err.message);
    return parseResponse(await callLLM(prompt, 5500), mode, seeds);
  }
}

/* ── Intent resolution ───────────────────────────────────── */

const MODE_OPTIONS = [
  { id: 'full', label: 'Full guide', hint: "I'm new" },
  { id: 'catch-up', label: 'Catch up', hint: "I'm familiar, getting back in" },
  { id: 'deep-dive', label: 'Deep dive', hint: 'The more obscure good stuff' },
];

const MAX_QUESTIONS = 3;

function buildIntentPrompt(prompt, answers) {
  const answered = answers.length
    ? `\nClarifications so far:\n${answers.map((a) => `- Q: ${a.question}\n  A: ${a.answer}`).join('\n')}\n`
    : '';
  const stop = answers.length >= MAX_QUESTIONS
    ? '\nYou have asked enough questions. Return "ready" now with your best interpretation.\n'
    : '';

  return `You are ComicPath's request resolver. A reader typed a free-text request for comic reading recommendations. Work out (a) the seeds — what they want to read about — and (b) the mode. Ask ONE clarifying question only when something is genuinely unclear.

Reader's request: "${prompt}"
${answered}${stop}
SEEDS:
- A seed is a character ("Batman"), a group read together ("Batman & Robin", a team like "X-Men"), or a story arc, event or series ("Absolute Power").
- Unclear entity — ask (kind "entity"): the name refers to clearly different, well-known entities, e.g. "Sandman" could be Dream of the Endless (Neil Gaiman), Wesley Dodds (Golden Age DC), or Marvel's Spider-Man villain. Give 2-4 options.
- Do NOT ask about mantles or continuity: default to mainstream continuity (DC: Prime Earth, Marvel: 616) and the most iconic version (e.g. "Flash" → Barry Allen) unless the request names an alternate. "Batman" alone is clear.
- Unclear seed structure — ask (kind "seedStructure"): the request names two or more characters without saying whether they want them together or each on their own, e.g. "titles about Batman and Robin". Options: only titles where they appear together (one group seed), or each one individually including crossovers (separate seeds). A team or series known by one name (e.g. "X-Men", "Guardians of the Galaxy") is a single group seed, no question.

MODE:
- full = Full guide, the reader is new; catch-up = Catch up, familiar and getting back in; deep-dive = Deep dive, the more obscure good stuff.
- Infer the mode from wording like "new to", "start", "from the beginning" (full), "catch me up", "getting back into", "latest" (catch-up), "obscure", "deep cuts", "hidden gems" (deep-dive).
- If nothing in the request or clarifications indicates the mode, ask (kind "mode").

Ask about the entity first, then seed structure, then mode. Never ask about something already answered.

Return ONLY a JSON object — no markdown, no preamble. Either:
{ "status": "clarify", "question": { "kind": "entity | seedStructure | mode", "text": "Which Sandman do you mean?", "options": [{ "id": "dream", "label": "Dream of the Endless", "hint": "Neil Gaiman's Vertigo series" }] } }
or:
{ "status": "ready", "mode": "full | catch-up | deep-dive", "seeds": [{ "name": "Batman", "type": "character | group | arc", "members": ["only for group seeds"] }] }`;
}

function parseIntent(text) {
  const data = parseJson(text);
  const validMode = (m) => MODE_OPTIONS.some((o) => o.id === m);

  if (data.status === 'ready') {
    const seeds = (Array.isArray(data.seeds) ? data.seeds : [])
      .filter((s) => s?.name)
      .slice(0, 6)
      .map((s, i) => ({
        id: `s${i + 1}`,
        name: String(s.name),
        type: normalizeSeedType(s.type),
        ...(Array.isArray(s.members) && s.members.length > 0 ? { members: s.members.map(String) } : {}),
      }));
    if (seeds.length === 0) throw new Error('Could not work out what to look up. Try rephrasing.');
    const { mode } = data;
    // A missing mode is asked about here rather than guessed.
    if (!validMode(mode)) {
      return { status: 'clarify', question: { kind: 'mode', text: 'How do you want to read?', options: MODE_OPTIONS } };
    }
    return { status: 'ready', mode, seeds };
  }

  const q = data.question || {};
  const kind = ['entity', 'seedStructure', 'mode'].includes(q.kind) ? q.kind : 'entity';
  const options = kind === 'mode'
    ? MODE_OPTIONS
    : (Array.isArray(q.options) ? q.options : [])
      .filter((o) => o?.label)
      .slice(0, 4)
      .map((o, i) => ({ id: String(o.id || `o${i + 1}`), label: String(o.label), hint: o.hint ? String(o.hint) : '' }));
  if (!q.text) throw new Error('Could not understand the request. Try rephrasing.');
  return { status: 'clarify', question: { kind, text: String(q.text), options } };
}

// One resolution step: either a clarifying question or the resolved seeds + mode.
// answers: [{ question, answer }] from earlier steps of the same request.
export async function resolveIntent(prompt, answers = []) {
  const text = await callLLM(buildIntentPrompt(prompt, answers), 1500);
  return parseIntent(text);
}
