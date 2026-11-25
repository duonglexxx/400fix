export const config = {
  runtime: 'edge',
  // Chỉ giữ region gần người dùng; bỏ các region không cần để giảm cold start
  regions: ['sin1', 'hnd1'],
};

const TARGET_HOST = 'https://openrouter.ai';
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
// Nếu muốn giới hạn chỉ cho endpoint chat:
// const ALLOWED_PATH_PREFIX = '/api/v1/chat/';

export default async function handler(req) {
  // 1) Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        // Mirror lại header client yêu cầu thay vì dùng '*'
        'Access-Control-Allow-Headers':
          req.headers.get('access-control-request-headers') || '*',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Access-Control-Request-Headers',
      },
    });
  }

  // 2) (Tuỳ chọn) Chặn path không mong muốn
  const url = new URL(req.url);
  // if (!url.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
  //   return json({ error: 'Forbidden path' }, 403);
  // }

  // 3) Forward headers cần thiết
  const headers = new Headers();
  const forward = [
    'authorization',
    'content-type',
    'accept',
    'accept-encoding',
    'user-agent',
  ];
  for (const h of forward) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Forward mọi header X-* (OpenRouter dùng X-Title, X-...)
  for (const [k, v] of req.headers) {
    if (k.toLowerCase().startsWith('x-') && !k.toLowerCase().startsWith('x-forwarded')) {
      headers.set(k, v);
    }
  }
  // Header bắt buộc cho OpenRouter
  headers.set('HTTP-Referer', headers.get('HTTP-Referer') || 'https://janitorai.com');
  headers.set('X-Title', headers.get('X-Title') || 'JanitorAI');

  // 4) Chuẩn bị body — Edge Runtime stream chỉ đọc 1 lần, nên chỉ lấy khi cần
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body = hasBody ? req.body : undefined;

  // 5) Timeout bằng AbortController (Edge hỗ trợ)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s

  try {
    const targetUrl = `${TARGET_HOST}${url.pathname}${url.search}`;
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    });

    // 6) Trả response — stream thẳng, copy header cần thiết
    const resHeaders = new Headers();
    // Copy các header quan trọng từ upstream
    for (const h of [
      'content-type',
      'content-length',
      'cache-control',
      'openai-model',
      'openai-processing-ms',
      'x-request-id',
    ]) {
      const v = upstream.headers.get(h);
      if (v) resHeaders.set(h, v);
    }
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Access-Control-Expose-Headers', 'x-request-id, openai-model');

    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 502;
    return json(
      { error: err.name === 'AbortError' ? 'Upstream timeout' : err.message },
      status
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
