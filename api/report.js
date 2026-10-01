// Vercel 函数：接收前端报错，写进运行日志（Vercel 控制台 → Logs 里按 [client-error] 搜索）。
// 只做长度截断和简单校验，不落库、不转发。
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body.message !== "string") { res.status(400).end(); return; }
  const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : undefined);
  console.error("[client-error]", JSON.stringify({
    kind: clip(body.kind, 20), message: clip(body.message, 300), stack: clip(body.stack, 1200),
    source: clip(body.source, 300), page: clip(body.page, 300), ua: clip(body.ua, 200), at: clip(body.at, 40),
  }));
  res.status(204).end();
}
