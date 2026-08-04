export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/comicvine/, '');
  const sep = path.includes('?') ? '&' : '?';
  const target = `https://comicvine.gamespot.com/api${path}${url.search}${sep}api_key=${process.env.COMICVINE_API_KEY}&format=json`;

  const headers = new Headers();
  headers.set('User-Agent', 'ComicPath/1.0');

  const res = await fetch(target, {
    method: request.method,
    headers,
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  });
}
