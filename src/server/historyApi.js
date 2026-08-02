import {
  buildComparison,
  figureById,
  figures,
  getPairColors,
  getTurningPoints,
} from "../data.js";
import { getCandleView } from "../marketEngine.js";

const VERSION = "2026.08.02";
const totalEvents = figures.reduce(
  (sum, figure) => sum + figure.events.length,
  0,
);

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
  "x-content-type-options": "nosniff",
};

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, ...extraHeaders },
  });

const compactFigure = (figure) => ({
  id: figure.id,
  name: figure.name,
  courtesy: figure.courtesy,
  dynasty: figure.dynasty,
  era: figure.era,
  period: figure.period,
  domain: figure.domain,
  born: figure.born,
  died: figure.died,
  lifeSpan: figure.lifeSpan,
  color: figure.color,
  thesis: figure.thesis,
  metrics: figure.metrics,
  eventCount: figure.events.length,
});

const apiMeta = () => ({
  version: VERSION,
  people: figures.length,
  events: totalEvents,
  generatedAt: new Date().toISOString(),
  axis: "actual-age",
  model: "interpretive-history-index",
});

function getPair(url) {
  const left = figureById[url.searchParams.get("left") || "liubang"];
  const right = figureById[url.searchParams.get("right") || "xiangyu"];
  if (!left || !right || left.id === right.id) return null;
  return { left, right };
}

export async function handleHistoryApi(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "GET, HEAD, OPTIONS",
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        "access-control-allow-headers": "Content-Type, Accept",
      },
    });
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return json({ error: "method_not_allowed" }, 405, { allow: "GET, HEAD, OPTIONS" });
  }

  if (url.pathname === "/api/health") {
    return json({ ok: true, meta: apiMeta() }, 200, { "cache-control": "no-store" });
  }

  if (url.pathname === "/api/figures") {
    const compact = url.searchParams.get("compact") === "1";
    return json({
      meta: apiMeta(),
      figures: compact ? figures.map(compactFigure) : figures,
    });
  }

  if (url.pathname.startsWith("/api/figures/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/figures/".length));
    const figure = figureById[id];
    return figure
      ? json({ meta: apiMeta(), figure })
      : json({ error: "figure_not_found", id }, 404);
  }

  if (url.pathname === "/api/compare") {
    const pair = getPair(url);
    if (!pair) {
      return json(
        { error: "invalid_pair", message: "left/right must be two different known figure ids" },
        400,
      );
    }
    const comparison = buildComparison(pair.left, pair.right);
    const response = {
      meta: apiMeta(),
      pair: {
        left: compactFigure(pair.left),
        right: compactFigure(pair.right),
      },
      colors: getPairColors(pair.left, pair.right),
      comparison,
      turningPoints: getTurningPoints(comparison, pair.left, pair.right),
    };
    if (url.searchParams.get("candles") === "1") {
      const target = url.searchParams.get("target") === pair.right.id
        ? pair.right
        : pair.left;
      response.candles = {
        figure: compactFigure(target),
        ...getCandleView(target, Number(url.searchParams.get("span")) || 100),
      };
    }
    return json(response, 200, { "cache-control": "public, max-age=300, s-maxage=3600" });
  }

  return json({ error: "api_route_not_found" }, 404, { "cache-control": "no-store" });
}
