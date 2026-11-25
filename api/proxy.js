export const config = {
  runtime: 'edge',
  regions: ['iad1', 'fra1'],
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  // Lấy trực tiếp đường dẫn gốc (ví dụ: /api/v1/chat/completions)
  const url = new URL(req.url);
  const targetUrl = `https://openrouter.ai${url.pathname}${url.search}`;

  const cleanHeaders = new Headers();
  cleanHeaders.set('Content-Type', req.headers.get('content-type') || 'application/json');
  if (req.headers.get('authorization')) {
    cleanHeaders.set('Authorization', req.headers.get('authorization'));
  }
  cleanHeaders.set('HTTP-Referer', 'https://janitorai.com');
  cleanHeaders.set('X-Title', 'JanitorAI');

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: cleanHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    const resHeaders = new Headers(response.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, target: targetUrl }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
