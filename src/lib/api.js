/* ============================================================
   ComicPath — API client (Groq LLM + ComicVine enrichment)
   ============================================================ */

import { searchComicVine } from './comicvine.js';

const API_URL = '/api/groq/openai/v1/chat/completions';

/* ── Disambiguation rules ─────────────────────────────────── */
const DISAMBIGUATION_RULES = `
DISAMBIGUATION & CONTINUITY RULES (follow strictly):
1. DEFAULT TO MAINSTREAM CONTINUITY: Unless the reader's query explicitly names an alternate universe, Elseworlds story, or specific imprint (e.g., "Ultimate Spider-Man", "Earth-2 Batman", "Tangent Superman"), always treat the character as their primary/mainstream version:
   - DC: Post-Crisis / Rebirth mainstream continuity (New Earth / Prime Earth)
   - Marvel: Earth-616 (main continuity)
2. ELSEWORLDS & ALTERNATES TIER ONLY: Stories from alternate continuities (Elseworlds, What If?, Ultimate universe, multiverse one-shots, Tangent, Amalgam, Injustice, etc.) belong EXCLUSIVELY in the "elseworldsStories" array. Never place them in "canonStories" or "secondaryStories."
3. AMBIGUOUS CHARACTERS: If the query matches multiple mainline characters who have held the same mantle (e.g., "Flash" could be Barry Allen or Wally West), default to the most historically foundational or iconic version. In the "aiNote" field, briefly mention that other versions exist and are worth exploring.
4. EXPLICIT ALTERNATE QUERIES: If the reader explicitly asks for an alternate version (e.g., "Ultimate Spider-Man", "Miles Morales", "Earth-2 Superman"), treat THAT version as the primary subject. Its canon stories go in "canonStories," and the mainstream version's stories may appear in "secondaryStories" or be omitted.
5. NEVER MIX CONTINUITIES: Do not recommend stories from one continuity as essential reading for a different continuity's version of the character.
`;

function buildPrompt(query, cvData) {
  let contextBlock = '';
  if (cvData) {
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
  }

  return `You are ComicPath, an expert comic book guide for new and returning readers.

A reader searched for: "${query}"
${contextBlock}
${DISAMBIGUATION_RULES}
Return ONLY a JSON object with this exact structure — no markdown, no preamble, no trailing text:

{
  "character": {
    "name": "Full character or team name",
    "initials": "2-3 letter initials",
    "publisher": "Publisher name",
    "firstAppearance": "YYYY",
    "description": "2-3 sentence overview written for someone who has never read this character.",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "canonStories": [
    {
      "title": "Story title",
      "year": "YYYY or YYYY–YYYY",
      "format": "Trade Paperback | Omnibus | Single Issues",
      "issues": "e.g. Batman #404–407 or Vol. 1",
      "why": "One sentence on why this is essential.",
      "readFirst": true,
      "issueList": [
        { "num": "1", "name": "Issue subtitle", "note": "Key event in one phrase" }
      ]
    }
  ],
  "secondaryStories": [
    {
      "title": "Story title",
      "year": "YYYY",
      "format": "Trade Paperback | Omnibus | Single Issues",
      "issues": "issues string",
      "why": "One sentence on why a fan would enjoy this."
    }
  ],
  "elseworldsStories": [
    {
      "title": "Story title",
      "year": "YYYY",
      "format": "Trade Paperback | Omnibus | Single Issues",
      "issues": "issues string",
      "why": "One sentence on what makes this alternate story interesting."
    }
  ],
  "skipStories": [
    {
      "title": "Story title",
      "year": "YYYY",
      "why": "One sentence on why to skip it."
    }
  ],
  "aiNote": "1–2 sentence personalized tip: a good entry point, a current renaissance, or reading-order advice.",
  "timeline": [
    { "title": "Short label", "year": 1987, "type": "canon" }
  ]
}

Rules:
- canonStories: 4–6 entries; include issueList (3–4 issues) for the top 2 only.
- secondaryStories: 3–4 entries, no issueList needed.
- elseworldsStories: 2–3 entries.
- skipStories: 2–3 entries.
- timeline: 6–10 items spanning the character's publication history.
- All text written for adults new to or returning to comics.
- NEVER use "Unknown" as any field value. If you don't know a specific detail, use your best knowledge to provide a real answer. Every title, publisher, year, and description must be a real, specific value.`;
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

  return data;
}

export async function fetchComicGuide(query) {
  let cvData = null;
  try {
    cvData = await searchComicVine(query);
  } catch (err) {
    console.warn('ComicVine lookup failed, falling back to LLM-only:', err.message);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      messages: [{ role: 'user', content: buildPrompt(query, cvData) }],
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
