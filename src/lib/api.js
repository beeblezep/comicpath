/* ============================================================
   ComicPath — API client (Groq LLM + ComicVine enrichment)
   ============================================================ */

import { searchComicVineSmartly, searchVolumes, searchStoryArcs } from './comicvine.js';

const API_URL = '/api/groq/openai/v1/chat/completions';

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

function buildRelatedTitlesPrompt(title, cvContext, existingTitles, refinementPrompt = '') {
  let contextBlock = '';
  if (cvContext) {
    const lines = [`Target: ${cvContext.name || title}`];
    if (cvContext.publisher) lines.push(`Publisher: ${cvContext.publisher}`);
    if (cvContext.startYear) lines.push(`Year: ${cvContext.startYear}`);
    if (cvContext.issueCount) lines.push(`Issues: ${cvContext.issueCount}`);
    if (cvContext.deck) lines.push(`Description: ${cvContext.deck}`);
    contextBlock = `\nVERIFIED DATA from ComicVine:\n${lines.join('\n')}\n`;
  }

  const excludeList = existingTitles.length > 0
    ? `\nDo NOT include any of these titles (they are already in the reading path):\n${existingTitles.map((t) => `- ${t}`).join('\n')}\n`
    : '';

  const refinementBlock = refinementPrompt
    ? `\nIMPORTANT — The reader has a specific request for this expansion:\n"${refinementPrompt}"\nPrioritize titles and connections that match this request. Still include essential context even if not explicitly mentioned, but weight your suggestions toward what the reader asked for.\n`
    : '';

  return `You are ComicPath, an expert comic book guide.

Given the comic title "${title}", suggest 4-8 related titles a reader should know about. Include direct prequels, sequels, crossovers, and thematically connected stories.
${contextBlock}${excludeList}${refinementBlock}
Return ONLY a JSON object — no markdown, no preamble, no trailing text.

Structure:
{
  "relatedNodes": [
    {
      "title": "Story or arc title",
      "year": "YYYY or YYYY-YYYY",
      "issues": "e.g. Batman #404-407",
      "why": "One sentence on why this matters.",
      "tier": "essential | recommended | optional",
      "weight": 3,
      "tags": ["origin", "crossover", "sequel"]
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
- 4-8 related titles. Categorize each as essential, recommended, or optional.
- weight: 1-5 (5 = most important).
- Edges should connect "${title}" to the related titles. Also include edges between related titles where relationships exist.
- Use real titles with accurate issue numbers from actual publications.
- tier: essential = must-read context, recommended = enriches the experience, optional = for completists.
- Edge types: leads-to (reading order), prerequisite (required background), branches-from (spin-off/side story), crossover (event tie-in).
- Never use "Unknown" — always provide real values.`;
}

function parseRelatedTitlesResponse(text) {
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

  return { relatedNodes: nodes, edges };
}

export async function fetchRelatedTitles(title, existingTitles = [], refinementPrompt = '') {
  let cvContext = null;
  try {
    const [volumes, arcs] = await Promise.all([
      searchVolumes(title).catch(() => []),
      searchStoryArcs(title).catch(() => []),
    ]);
    const match = volumes[0] || arcs[0] || null;
    if (match) {
      cvContext = {
        name: match.name,
        publisher: match.publisher?.name || match.publisher || '',
        startYear: match.start_year || match.startYear || '',
        issueCount: match.count_of_issues || match.issueCount || '',
        deck: match.deck || '',
      };
    }
  } catch (err) {
    console.warn('ComicVine lookup failed for related titles:', err.message);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: 4000,
      messages: [{ role: 'user', content: buildRelatedTitlesPrompt(title, cvContext, existingTitles, refinementPrompt) }],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.error?.message || response.statusText;
    throw new Error(`API error ${response.status}: ${msg}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseRelatedTitlesResponse(text);
}

export async function fetchComicGuide(query, mode = 'full') {
  let cvData = null;
  try {
    cvData = await searchComicVineSmartly(query);
  } catch (err) {
    console.warn('ComicVine lookup failed, falling back to LLM-only:', err.message);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: 5500,
      messages: [{ role: 'user', content: buildPrompt(query, cvData, mode) }],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.error?.message || response.statusText;
    throw new Error(`API error ${response.status}: ${msg}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseResponse(text);
}
