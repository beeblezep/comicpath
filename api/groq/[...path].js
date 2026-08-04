export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/groq/, '');
  const target = `https://api.groq.com${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${process.env.GROQ_API_KEY}`);
  headers.delete('host');

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: request.method !== 'GET' ? request.body : undefined,
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  });
}
