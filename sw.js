// 仅缓存 /audio/*.mp3（cache-first）。index.html 等其他请求一律不拦截，直接走网络，
// 因此不会出现页面版本过期的问题。
// 重新生成/替换过 mp3 后，把 AUDIO_CACHE 版本号加一（同时修改 index.html 里的 AUDIO_CACHE_NAME）。
const AUDIO_CACHE = 'chinese-audio-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k !== AUDIO_CACHE) // 清掉旧版 sw 遗留的 chinese-kids-v1 等缓存
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!/\/audio\/[^/]+\.mp3$/i.test(url.pathname)) return;
  event.respondWith(handleAudio(req));
});

async function handleAudio(req) {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    let res = await cache.match(req.url);
    if (!res) {
      // 始终取完整文件（不带 Range），再按需切片返回
      res = await fetch(req.url);
      if (res.status === 200 || res.status === 404) {
        // 404 也缓存：缺失的整词文件之后不再产生网络往返，直接走逐字播放
        cache.put(req.url, res.clone()).catch(() => {});
      }
      if (res.status !== 200) return res;
    }
    if (res.status !== 200) return res;
    const range = req.headers.get('range');
    if (!range) return res;
    return sliceResponse(res, range);
  } catch (e) {
    return Response.error();
  }
}

async function sliceResponse(res, rangeHeader) {
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!m || (m[1] === '' && m[2] === '')) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start, end;
  if (m[1] === '') {
    start = Math.max(0, size - parseInt(m[2], 10));
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1)
    }
  });
}
