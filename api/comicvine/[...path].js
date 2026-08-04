export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/comicvine/, '');
  const sep = path.includes('?') ? '&' : '?';
  const target = `https://comicvine.gamespot.com/api${path}${sep}api_key=${process.env.COMICVINE_API_KEY}&format=json`;

  try {
    const response = await fetch(target, {
      headers: { 'User-Agent': 'ComicPath/1.0' },
    });

    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/json').send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
