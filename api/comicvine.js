export default async function handler(req, res) {
  const proxyPath = req.query.__path || '';
  const params = { ...req.query };
  delete params.__path;
  params.api_key = process.env.COMICVINE_API_KEY;
  params.format = 'json';

  const qs = new URLSearchParams(params).toString();
  const target = `https://comicvine.gamespot.com/api/${proxyPath}${qs ? '?' + qs : ''}`;

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
