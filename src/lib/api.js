/* ============================================================
   ComicPath — Anthropic API client
   ============================================================ */

const API_URL = '/api/groq/openai/v1/chat/completions';

/**
 * Build the structured prompt for a character/team/theme search.
 * Returns a prompt string that instructs the model to return pure JSON.
 */
function buildPrompt(query) {
  return `You are ComicPath, an expert comic book guide for new and returning readers.

A reader searched for: "${query}"

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
- All text written for adults new to or returning to comics.`;
}

/**
 * Parse the model's text response into a JS object.
 * Strips markdown code fences if present.
 */
function parseResponse(text) {
  const clean = text.replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Fall back: grab the first {...} block
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Response was not valid JSON');
  }
}

/**
 * Fetch a comic reading guide for `query`.
 * Returns the parsed data object or throws.
 */
export async function fetchComicGuide(query) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      messages: [{ role: 'user', content: buildPrompt(query) }],
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
