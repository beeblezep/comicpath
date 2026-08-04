export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/groq/, '');
  const target = `https://api.groq.com${path}`;

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/json').send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
