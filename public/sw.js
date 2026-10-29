// 离线缓存（10-20，用户：图片偶尔裂图，要求下过一次就留在浏览器里）。
// 只管三类静态文件，其余请求（页面本身、/api）一律直连，不缓存：
//   /portraits/*  头像：缓存优先，后台用「条件请求」(no-cache) 顺手更新，换了头像下次就是新的；忽略 ?r= 重试参数，重试也能命中缓存。
//   /fonts/*、/assets/*  只缓存文件名里带内容哈希的（hms-sans-3.ab12cd34.woff2、index-AbCd1234.js）：内容变了名字就变，缓存优先最安全。
//                        没有哈希的（许可证文本、固定名字的图标）不碰，永远走网络，免得更新后一直拿到旧的。
// 改了缓存规则就把 VERSION 加一，旧缓存会在激活时清掉。
const VERSION = "hms-v3";
const PORTRAITS = `${VERSION}-portraits`, STATIC = `${VERSION}-static`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try {
      for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    } catch {} // 缓存受限时仍激活，页面资源直接走网络。
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/portraits/")) e.respondWith(staleWhileRevalidate(req, url));
  else if ((url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/assets/")) && HASHED.test(url.pathname)) e.respondWith(cacheFirst(req, url));
});

const HASHED = /[-.][A-Za-z0-9_-]{8}\.[a-z0-9]+$/;
const MAX_STATIC = 400; // 每次发布分包名都会变，旧的不再用；超过就删最早存的，免得缓存越积越大

const keyOf = (url) => url.origin + url.pathname; // 去掉 ?r= / ?retry= 这类重试参数

async function staleWhileRevalidate(req, url) {
  let cache, hit;
  try { cache = await caches.open(PORTRAITS); hit = await cache.match(keyOf(url)); } catch {}
  // 后台更新用 no-cache：浏览器自己的 HTTP 缓存可能还在有效期里，不加这个就永远拿不到换掉的头像
  const fresh = fetch(new Request(req, { cache: hit ? "no-cache" : "default" })).then((res) => { if (res.ok && cache) cache.put(keyOf(url), res.clone()).catch(() => {}); return res; });
  if (hit) { fresh.catch(() => {}); return hit; }
  return fresh;
}

async function cacheFirst(req, url) {
  let cache, hit;
  try { cache = await caches.open(STATIC); hit = await cache.match(keyOf(url)); } catch {}
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && cache) {
    try {
      await cache.put(keyOf(url), res.clone());
      const keys = await cache.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await cache.delete(k);
    } catch {} // 存储满或隐私限制不能把成功下载的脚本变成加载失败。
  }
  return res;
}
