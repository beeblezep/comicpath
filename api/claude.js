import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 60 };

const DEFAULT_MODEL = 'claude-opus-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Claude not configured' });
  }

  const prompt = req.body?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    // Keys that aren't scoped to a workspace must name one on every request.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    const client = new Anthropic(
      workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {},
    );
    const message = await client.messages
      .stream({
        model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
        max_tokens: 16000,
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: prompt }],
      })
      .finalMessage();

    if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: `Claude stopped early: ${message.stop_reason}` });
    }

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    res.status(200).json({ text });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(401).json({ error: 'Invalid Anthropic API key' });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'Claude rate limit reached' });
    } else if (err instanceof Anthropic.APIError) {
      res.status(err.status || 502).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
}
