export const config = {
  runtime: 'edge',
  // Ép buộc chạy tại Bờ Đông nước Mỹ (Washington D.C.) hoặc Đức (Frankfurt), né hoàn toàn Châu Á
  regions: ['iad1', 'fra1'],
};

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '';
  url.searchParams.delete('path');
  const query = url.searchParams.toString();
  const targetUrl = `https://openrouter.ai{path}${query ? `?${query}` : ''}`;

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

  // Chỉ giữ lại đúng các header cần thiết cho API, loại bỏ hoàn toàn dấu vết của trình duyệt/Vercel
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
