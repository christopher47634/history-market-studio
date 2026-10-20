// 离线缓存（10-20，用户：图片偶尔裂图，要求下过一次就留在浏览器里）。
// 只管三类静态文件，其余请求（页面本身、/api）一律直连，不缓存：
//   /portraits/*  头像：缓存优先，后台顺手更新（stale-while-revalidate）；忽略 ?r= 重试参数，重试也能命中缓存。
//   /fonts/*      字体分片：缓存优先。
//   /assets/*     带哈希的脚本、样式、数据分包：缓存优先（文件名变了就是新文件）。
// 改了缓存规则就把 VERSION 加一，旧缓存会在激活时清掉。
const VERSION = "hms-v1";
const PORTRAITS = `${VERSION}-portraits`, STATIC = `${VERSION}-static`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/portraits/")) e.respondWith(staleWhileRevalidate(req, url));
  else if (url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/assets/")) e.respondWith(cacheFirst(req, url));
});

const keyOf = (url) => url.origin + url.pathname; // 去掉 ?r= / ?retry= 这类重试参数

async function staleWhileRevalidate(req, url) {
  const cache = await caches.open(PORTRAITS);
  const hit = await cache.match(keyOf(url));
  const fresh = fetch(req).then((res) => { if (res.ok) cache.put(keyOf(url), res.clone()); return res; });
  if (hit) { fresh.catch(() => {}); return hit; }
  return fresh;
}

async function cacheFirst(req, url) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(keyOf(url));
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(keyOf(url), res.clone());
  return res;
}
