/* ============================================================
   ComicPath — API client (Claude LLM with Groq fallback + ComicVine enrichment)
   ============================================================ */

import { searchComicVineSmartly, searchVolumes, searchStoryArcs, getVolumeIssues } from './comicvine.js';
import { FORMAT_WORDS } from './formatIntent.js';

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
- Alternate-continuity stories go ONLY in "elseworldsStories" — never in canon or secondary.
- For ambiguous mantles (e.g. "Flash"), default to the most iconic version; mention others in "aiNote".
- If an alternate is explicitly requested, treat it as primary; don't mix continuities.
`;

const CONSTELLATION_GRAPH_SCHEMA = `
"constellationGraph": {
  "targetTitle": "The specific title the reader is building toward, or null if exploring broadly",
  "nodes": [
    {
      "id": "n1",
      "title": "Story or arc title",
      "year": "YYYY or YYYY–YYYY",
      "issues": "e.g. Batman #404–407",
      "why": "One sentence on why this matters for the reading journey.",
      "tier": "essential | recommended | optional",
      "weight": 3,
      "tags": ["origin", "crossover", "recent"]
    }
  ],
  "edges": [
    {
      "source": "n1",
      "target": "n2",
      "type": "leads-to | prerequisite | branches-from | crossover",
      "label": "optional short label for the connection"
    }
  ],
  "pathNote": "One sentence tip about this reading constellation."
}`;

const MODE_INSTRUCTIONS = {
  full: '8-12 nodes spanning the character\'s publication history from origin to present. Use "leads-to" edges for the main chronological path. Branch off with "branches-from" for optional side stories, "crossover" for event tie-ins. Weight the most iconic stories 4-5, moderate ones 3, minor tie-ins 1-2.',
  'catch-up': '5-8 nodes starting from a recent good entry point to get the reader current. Tighter graph with mostly "leads-to" and "prerequisite" edges. Weight the entry point and destination highest (4-5). Only truly essential tie-ins.',
  'deep-dive': '6-10 nodes showing the prerequisites and lead-up to the character\'s most relevant current or recent arc. Use "prerequisite" edges for required reading, "crossover" for event tie-ins, "branches-from" for depth stories. Weight the target arc node 5.',
};

function buildPrompt(query, cvData, mode = 'full') {
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

The reader wants to catch up on recent events and context LEADING UP TO this title. Build a constellation graph where this target title is the destination node (weight 5). Include prerequisite stories, related arcs, and crossover events that provide essential context.

IMPORTANT: Use your knowledge of this title's continuity to recommend real titles with accurate issue numbers, years, and titles.
`;
    }
  }

  const targetInstruction = queryType !== 'character'
    ? `\nThe "targetTitle" field should be set to "${query}" — the title the reader is building toward. This node should have weight 5 and appear as the destination in the graph.`
    : '\nSet "targetTitle" to null since this is a character-based exploration.';

  return `You are ComicPath, an expert comic book guide for new and returning readers.

A reader searched for: "${query}"
${contextBlock}
${DISAMBIGUATION_RULES}
Return ONLY a JSON object — no markdown, no preamble, no trailing text.

Structure:
{
  "character": { "name": "", "initials": "XX", "publisher": "", "firstAppearance": "YYYY", "description": "2-3 sentences.", "tags": [] },
  "canonStories": [{ "title": "", "year": "", "format": "Trade Paperback|Omnibus|Single Issues", "issues": "", "why": "", "readFirst": true, "issueList": [{"num":"1","name":"","note":""}] }],
  "secondaryStories": [{ "title": "", "year": "", "format": "", "issues": "", "why": "" }],
  "elseworldsStories": [{ "title": "", "year": "", "format": "", "issues": "", "why": "" }],
  "skipStories": [{ "title": "", "year": "", "why": "" }],
  "aiNote": "1-2 sentence tip.",
  "timeline": [{ "title": "", "year": 1987, "type": "canon" }],
  ${CONSTELLATION_GRAPH_SCHEMA}
}

Rules:
- canonStories: 4-6 entries; issueList (3-4 issues) for top 2 only.
- secondaryStories: 3-4. elseworldsStories: 2-3. skipStories: 2-3.
- timeline: 6-10 items spanning publication history.
- constellationGraph: ${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.full} Connected graph, no orphan nodes. IDs: "n1","n2",etc. tier: essential|recommended|optional. weight: 1-5. Edge type: leads-to|prerequisite|branches-from|crossover.${targetInstruction}
- Never use "Unknown" — always provide real values.`;
}

function parseResponse(text) {
  const clean = text.replace(/```json|```/gi, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Response was not valid JSON');
  }
  return validateResponse(parsed);
}

function validateResponse(data) {
  if (!data.character?.name || data.character.name.toLowerCase() === 'unknown') {
    throw new Error('Invalid response: missing character name');
  }
  if (data.character.publisher?.toLowerCase() === 'unknown') {
    data.character.publisher = null;
  }
  if (data.character.firstAppearance?.toLowerCase() === 'unknown') {
    data.character.firstAppearance = null;
  }

  const stripUnknown = (stories) =>
    (stories || []).filter((s) => s.title && s.title.toLowerCase() !== 'unknown');

  data.canonStories = stripUnknown(data.canonStories);
  data.secondaryStories = stripUnknown(data.secondaryStories);
  data.elseworldsStories = stripUnknown(data.elseworldsStories);
  data.skipStories = stripUnknown(data.skipStories);

  if (data.canonStories.length === 0) {
    throw new Error('Invalid response: no canon stories returned');
  }

  data.constellationGraph = validateConstellationGraph(data.constellationGraph)
    || readingPathToGraph(data.readingPath);

  return data;
}

const VALID_TIERS = new Set(['essential', 'recommended', 'optional']);
const VALID_EDGE_TYPES = new Set(['leads-to', 'prerequisite', 'branches-from', 'crossover']);

function validateConstellationGraph(cg) {
  if (!cg || !Array.isArray(cg.nodes) || cg.nodes.length === 0) return null;

  let idCounter = 1;
  const nodes = cg.nodes.slice(0, 15).map((n) => {
    const id = n.id || `n${idCounter++}`;
    return {
      id,
      title: n.title || 'Untitled',
      year: n.year || '',
      issues: n.issues || '',
      why: n.why || '',
      tier: VALID_TIERS.has(n.tier) ? n.tier : 'recommended',
      weight: Math.min(5, Math.max(1, Number(n.weight) || 3)),
      tags: Array.isArray(n.tags) ? n.tags : [],
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges = (cg.edges || []).slice(0, 30)
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      type: VALID_EDGE_TYPES.has(e.type) ? e.type : 'leads-to',
      label: e.label || '',
    }));

  const connectedIds = new Set();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }
  const connectedNodes = nodes.filter((n) => connectedIds.has(n.id));

  if (connectedNodes.length === 0) return null;

  return {
    targetTitle: cg.targetTitle || null,
    nodes: connectedNodes,
    edges,
    pathNote: cg.pathNote || '',
  };
}

function readingPathToGraph(rp) {
  if (!rp || !Array.isArray(rp.mainLine) || rp.mainLine.length === 0) return null;

  const nodes = [];
  const edges = [];

  rp.mainLine.forEach((node, i) => {
    const id = node.id || `n${i + 1}`;
    nodes.push({
      id,
      title: node.title || 'Untitled',
      year: node.year || '',
      issues: node.issues || '',
      why: node.why || '',
      tier: VALID_TIERS.has(node.tier) ? node.tier : 'recommended',
      weight: i === 0 ? 4 : i === rp.mainLine.length - 1 ? 5 : 3,
      tags: [],
    });

    if (i > 0) {
      const prevId = rp.mainLine[i - 1].id || `n${i}`;
      edges.push({ source: prevId, target: id, type: 'leads-to', label: '' });
    }

    (node.branches || []).forEach((branch, bi) => {
      if (!Array.isArray(branch)) return;
      branch.forEach((bn, bni) => {
        const bid = bn.id || `n${i + 1}b${bi}${bni}`;
        nodes.push({
          id: bid,
          title: bn.title || 'Untitled',
          year: bn.year || '',
          issues: bn.issues || '',
          why: bn.why || '',
          tier: VALID_TIERS.has(bn.tier) ? bn.tier : 'optional',
          weight: 2,
          tags: [],
        });
        edges.push({ source: id, target: bid, type: 'branches-from', label: '' });
      });
    });
  });

  return {
    targetTitle: null,
    nodes,
    edges,
    pathNote: rp.pathNote || '',
  };
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

function buildRelatedTitlesPrompt(titles, cvContexts, existingTitles, refinementPrompt = '', requestContext = null, format = 'issues') {
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
    ? '- Up to 8 titles, all matching the reader\'s request. Categorize each as essential, recommended, or optional.'
    : '- 4-8 related titles. Categorize each as essential, recommended, or optional.';
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
${contextBlock}${excludeList}${refinementBlock}
Return ONLY a JSON object — no markdown, no preamble, no trailing text.

Structure:
{
${noteField}  "relatedNodes": [
    {
      "title": "${collected ? 'Published title of the collected edition' : 'Story or arc title'}",
      "year": "YYYY or YYYY-YYYY",
      "issues": "e.g. Batman #404-407",
      "why": "One sentence on why this matters.",
      "tier": "essential | recommended | optional",
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
- tier: essential = must-read context, recommended = enriches the experience, optional = for completists.
- Edge types: leads-to (reading order), prerequisite (required background), branches-from (spin-off/side story), crossover (event tie-in).
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
  const clean = text.replace(/```json|```/gi, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Response was not valid JSON');
  }

  const nodes = (parsed.relatedNodes || []).slice(0, 10).map((n) => ({
    title: n.title || 'Untitled',
    year: n.year || '',
    issues: n.issues || '',
    why: n.why || '',
    tier: VALID_TIERS.has(n.tier) ? n.tier : 'recommended',
    weight: Math.min(5, Math.max(1, Number(n.weight) || 3)),
    tags: Array.isArray(n.tags) ? n.tags : [],
    ...(format === 'collected' ? parseEdition(n) : {}),
  }));

  const edges = (parsed.edges || []).slice(0, 20).map((e) => ({
    sourceTitle: e.sourceTitle || '',
    targetTitle: e.targetTitle || '',
    type: VALID_EDGE_TYPES.has(e.type) ? e.type : 'leads-to',
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

export async function fetchRelatedTitles(titleOrTitles, existingTitles = [], refinementPrompt = '', format = 'issues') {
  const titles = Array.isArray(titleOrTitles) ? titleOrTitles : [titleOrTitles];
  const [cvContexts, requestContext] = await Promise.all([
    Promise.all(titles.slice(0, 3).map(lookupTitleContext)),
    refinementPrompt ? lookupRequestContext(refinementPrompt) : null,
  ]);

  const text = await callLLM(
    buildRelatedTitlesPrompt(titles, cvContexts, existingTitles, refinementPrompt, requestContext, format),
    4000,
  );
  return parseRelatedTitlesResponse(text, format);
}

export async function fetchComicGuide(query, mode = 'full') {
  let cvData = null;
  try {
    cvData = await searchComicVineSmartly(query);
  } catch (err) {
    console.warn('ComicVine lookup failed, falling back to LLM-only:', err.message);
  }

  const text = await callLLM(buildPrompt(query, cvData, mode), 5500);
  return parseResponse(text);
}
